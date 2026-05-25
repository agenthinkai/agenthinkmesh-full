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
import DataRoomBatch from "@/components/DataRoomBatch";
import DataRoomV2 from "@/components/DataRoomV2";
import { DecisionUpgradePanel } from "@/components/DecisionUpgradePanel";
import { ScenarioSimDashboard, ScenarioSimToggle } from "@/components/ScenarioSimDashboard";
import { ReportsPanel } from "@/components/ReportsPanel";
import { trackEvent } from "@/lib/analytics";

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
type VerdictType = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED" | "INSUFFICIENT_DATA";

// ── Reality Alignment Engine result type ─────────────────────────────────────
interface RealityAlignmentResult {
  dataConfidence: "LOW" | "MEDIUM" | "HIGH";
  missingFields: string[];
  conflictScore: number;
  consensusQuality: number;
  shouldGate: boolean;
  gateReason?: string;
  agentAlignments: Array<{ personaId: string; alignmentScore: number; flaggedClaims: string[] }>;
  conflictDetails: string[];
  debugLog: string[];
}

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
  councilMode?: "gcc" | "global_vc" | "india_pe" | "gcc_equities" | "infrastructure";
  evidenceBlob?: string | null;
  icReport?: ICReportData | null;
  universitySignal?: UniversitySignal | null;
  precedents?: Array<{ taskDescription: string; finalVerdict: string | null; similarity: number; }>;
  duplicate?: boolean;
  triage?: { decision: string; confidence: number; reason: string; durationMs: number; } | null;
  realityAlignment?: RealityAlignmentResult | null;
  decisionIntegrity?: DecisionIntegrityData | null;
  finalScore?: number;
  consensusQuality?: number;
  investorMode?: boolean;
  createdAt?: Date | string | null;
  dealTextPreview?: string | null;
}

// ── Decision Integrity type (Adversarial Council) ──────────────────────────────────────────────
interface AdversarialChallenge {
  agentId: string;
  agentName: string;
  objection: string;
}
interface AdversarialClaim {
  agentId: string;
  agentName: string;
  claim: string;
}
interface AgentContribution {
  agentId: string;
  agentName: string;
  contribution: "HIGH" | "MEDIUM" | "LOW";
  newSignal: boolean;
  influencedDecision: boolean;
  triggeredChallenge: boolean;
}
interface DecisionIntegrityData {
  challengesRaised: AdversarialChallenge[];
  survivingClaims: AdversarialClaim[];
  vetoTriggered: boolean;
  vetoReason: string | null;
  unresolvedObjection: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  agentsRun: number;
  agentContributions: AgentContribution[];
  disagreementCount?: number;
  runtimeMs?: number;
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
  decisionConfidence?: {
    level: "HIGH" | "MEDIUM" | "LOW";
    limitations: string[];
    dataGaps: string[];
  } | null;
  whatWouldChangeDecision?: {
    upgradeFactors: string[];
    downgradeFactors: string[];
    keyMonitoringMetrics: string[];
  } | null;
  groundedFacts?: string[];
  inferredInsights?: string[];
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
  // GCC Equities
  GCC_EQ_MACRO:      { icon: "🌍", color: "#4a9eff" },
  GCC_EQ_RISK:       { icon: "🛡️", color: "#ff9f43" },
  GCC_EQ_SHARIAH:    { icon: "☪️",  color: "#00ff87" },
  GCC_EQ_REG:        { icon: "⚖️",  color: "#ff4757" },
  GCC_EQ_DISCLOSURE: { icon: "📋", color: "#a855f7" },
  GCC_EQ_FORENSIC:   { icon: "🔍", color: "#ff9f43" },
  GCC_EQ_QUANT:      { icon: "📐", color: "#4a9eff" },
  GCC_EQ_LIQUIDITY:  { icon: "💧", color: "#00ff87" },
  GCC_EQ_ESG:        { icon: "🌱", color: "#00ff87" },
  GCC_EQ_CONTRARIAN: { icon: "🔥", color: "#ff4757" },
};

type CouncilModeType = "gcc" | "global_vc" | "india_pe" | "gcc_equities" | "infrastructure";

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
  gcc_equities: [
    { id: "GCC_EQ_MACRO",       label: "GCC Macro Strategist" },
    { id: "GCC_EQ_RISK",        label: "Risk & Volatility" },
    { id: "GCC_EQ_SHARIAH",     label: "Shariah Screener" },
    { id: "GCC_EQ_REG",         label: "Regulatory & CMA" },
    { id: "GCC_EQ_DISCLOSURE",  label: "Disclosure Analyst" },
    { id: "GCC_EQ_FORENSIC",    label: "Forensic Accountant" },
    { id: "GCC_EQ_QUANT",       label: "Quant / NAV Math" },
    { id: "GCC_EQ_LIQUIDITY",   label: "Liquidity & Market Micro" },
    { id: "GCC_EQ_ESG",         label: "ESG & Governance" },
    { id: "GCC_EQ_CONTRARIAN",  label: "Contrarian" },
  ],
  infrastructure: [
    { id: "INFRA_PROJECT_FINANCE", label: "Project Finance Analyst" },
    { id: "INFRA_REGULATORY",      label: "Regulatory & Permitting Counsel" },
    { id: "INFRA_OFFTAKE",         label: "Offtake & Revenue Analyst" },
    { id: "INFRA_SKEPTIC",         label: "Infrastructure Skeptic" },
    { id: "INFRA_EPC",             label: "EPC & Construction Risk" },
    { id: "INFRA_TECH",            label: "Technology & Operations" },
    { id: "INFRA_ESG",             label: "ESG & Climate Risk" },
    { id: "INFRA_MACRO",           label: "Infrastructure Macro" },
    { id: "INFRA_IRR",             label: "IRR & Returns Analyst" },
    { id: "INFRA_CONTRARIAN",      label: "Infrastructure Contrarian" },
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

// ── DisagreementBadge ────────────────────────────────────────────────────────
function DisagreementBadge({ count }: { count: number }) {
  const _MONO = "'JetBrains Mono', 'Fira Code', monospace";
  const _AMBER = "#ffa502";
  const _MUTED = "rgba(255,255,255,0.35)";
  const isHigh = count >= 3;
  const label = count === 0 ? "Consensus aligned" : `Disagreement: ${count} agent${count === 1 ? "" : "s"}`;
  const color = count === 0 ? "rgba(0,255,135,0.7)" : isHigh ? _AMBER : _MUTED;
  const borderColor = count === 0 ? "rgba(0,255,135,0.25)" : isHigh ? `${_AMBER}55` : "rgba(255,255,255,0.12)";
  const bg = count === 0 ? "rgba(0,255,135,0.06)" : isHigh ? `${_AMBER}12` : "rgba(255,255,255,0.04)";
  function handleClick() {
    if (count === 0) return;
    window.dispatchEvent(new CustomEvent("expand-decision-integrity"));
    setTimeout(() => {
      const el = document.getElementById("decision-integrity-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }
  return (
    <button
      onClick={handleClick}
      title={count === 0 ? "All agents aligned with verdict" : `${count} agent${count === 1 ? "" : "s"} voted against the final verdict direction — click to view Decision Integrity`}
      style={{
        fontFamily: _MONO,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color,
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 3,
        padding: "3px 8px",
        cursor: count === 0 ? "default" : "pointer",
        transition: "opacity 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {isHigh ? "⚠ " : ""}{label.toUpperCase()}
    </button>
  );
}

// ── Verdict badge ─────────────────────────────────────────────────────────────────────────────────
function VerdictBadge({ verdict, compact = false }: { verdict: VerdictType; compact?: boolean }) {
  const config = {
    APPROVED: { label: compact ? "APPROVED" : "APPROVED", bg: "rgba(0,255,135,0.12)", border: "#00ff87", color: "#00ff87", glow: compact ? "none" : "0 0 20px rgba(0,255,135,0.3)" },
    APPROVED_WITH_CONDITIONS: { label: compact ? "CONDITIONAL" : "APPROVED WITH CONDITIONS", bg: "rgba(74,158,255,0.12)", border: "#4a9eff", color: "#4a9eff", glow: compact ? "none" : "0 0 20px rgba(74,158,255,0.3)" },
    REJECTED: { label: "REJECTED", bg: "rgba(255,71,87,0.12)", border: "#ff4757", color: "#ff4757", glow: compact ? "none" : "0 0 20px rgba(255,71,87,0.3)" },
    VETOED: { label: "VETOED", bg: "rgba(255,71,87,0.18)", border: "#ff4757", color: "#ff4757", glow: compact ? "none" : "0 0 30px rgba(255,71,87,0.5)" },
    INSUFFICIENT_DATA: { label: compact ? "INSUFF. DATA" : "INSUFFICIENT DATA", bg: "rgba(255,159,67,0.12)", border: "#ff9f43", color: "#ff9f43", glow: compact ? "none" : "0 0 20px rgba(255,159,67,0.3)" },
  }[verdict] ?? { label: verdict, bg: "rgba(100,100,100,0.12)", border: "#888", color: "#888", glow: "none" };
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

// ── VoteCard ───────// ── QuantitativeEvidenceSection ─────────────────────────────────
function QuantitativeEvidenceSection({ evidenceBlob }: { evidenceBlob: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: BG2,
      border: `1px solid rgba(74,158,255,0.25)`,
      borderLeft: `3px solid ${ACCENT}`,
      borderRadius: 8,
      marginBottom: 20,
      overflow: "hidden",
    }}>
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: ACCENT,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.15em", flex: 1, textAlign: "left" }}>
          📊 QUANTITATIVE EVIDENCE
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
          {open ? "▲ COLLAPSE" : "▼ EXPAND"}
        </span>
      </button>
      {/* Body */}
      {open && (
        <div style={{ padding: "0 20px 16px" }}>
          <pre style={{
            fontFamily: MONO,
            fontSize: 11,
            color: TEXT2,
            background: BG3,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: "12px 16px",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.6,
            margin: 0,
          }}>
            {evidenceBlob}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── VoteCard ────────────────────────────────────────────
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
// ── DecisionIntegritySection ───────────────────────────────────────────────────────────────────────────
function DecisionIntegritySection({ di }: { di: DecisionIntegrityData }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("expand-decision-integrity", handler);
    return () => window.removeEventListener("expand-decision-integrity", handler);
  }, []);
  const MONO = "'JetBrains Mono', 'Fira Code', monospace";
  const BORDER = "rgba(255,255,255,0.07)";
  const ACCENT = "#4a9eff";
  const GREEN = "#00ff87";
  const RED = "#ff4757";
  const AMBER = "#ffa502";
  const PURPLE = "#a855f7";

  const riskColor = di.riskLevel === "HIGH" ? RED : di.riskLevel === "MEDIUM" ? AMBER : GREEN;
  const contribColor = (c: "HIGH" | "MEDIUM" | "LOW") =>
    c === "HIGH" ? GREEN : c === "MEDIUM" ? ACCENT : "rgba(255,255,255,0.35)";

  return (
    <div id="decision-integrity-section" style={{
      marginBottom: 16,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "rgba(255,255,255,0.03)",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", color: ACCENT }}>DECISION INTEGRITY</span>
          <span style={{
            fontFamily: MONO, fontSize: 10,
            padding: "2px 7px",
            borderRadius: 4,
            background: `${riskColor}18`,
            border: `1px solid ${riskColor}55`,
            color: riskColor,
          }}>{di.riskLevel} RISK</span>
          {di.vetoTriggered && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>🚫 VETO</span>
          )}
          {di.unresolvedObjection && !di.vetoTriggered && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: AMBER }}>⚠ UNRESOLVED</span>
          )}
          <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            {di.challengesRaised.length} challenge{di.challengesRaised.length !== 1 ? "s" : ""} · {di.survivingClaims.length} surviving claim{di.survivingClaims.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Veto reason */}
          {di.vetoTriggered && di.vetoReason && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(255,71,87,0.08)",
              border: `1px solid ${RED}44`,
              borderRadius: 6,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginBottom: 4, letterSpacing: "0.06em" }}>VETO REASON</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>{di.vetoReason}</div>
            </div>
          )}

          {/* Challenges raised */}
          {di.challengesRaised.length > 0 && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginBottom: 8, letterSpacing: "0.06em" }}>CHALLENGES RAISED</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {di.challengesRaised.map((c, i) => (
                  <div key={i} style={{
                    padding: "8px 12px",
                    background: "rgba(255,71,87,0.05)",
                    border: `1px solid rgba(255,71,87,0.2)`,
                    borderRadius: 5,
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: RED, marginRight: 8 }}>{c.agentName}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{c.objection}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Surviving claims */}
          {di.survivingClaims.length > 0 && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, marginBottom: 8, letterSpacing: "0.06em" }}>SURVIVING CLAIMS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {di.survivingClaims.map((c, i) => (
                  <div key={i} style={{
                    padding: "8px 12px",
                    background: "rgba(0,255,135,0.04)",
                    border: `1px solid rgba(0,255,135,0.18)`,
                    borderRadius: 5,
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN, marginRight: 8 }}>{c.agentName}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{c.claim}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent contributions */}
          {di.agentContributions.length > 0 && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, marginBottom: 8, letterSpacing: "0.06em" }}>AGENT CONTRIBUTIONS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {di.agentContributions.map((a, i) => (
                  <div key={i} style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    background: `${contribColor(a.contribution)}10`,
                    border: `1px solid ${contribColor(a.contribution)}30`,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: contribColor(a.contribution) }}>{a.agentName}</span>
                    {a.influencedDecision && <span title="Influenced final decision" style={{ fontSize: 10 }}>⚡</span>}
                    {a.newSignal && <span title="Raised unique signal" style={{ fontSize: 10 }}>🔍</span>}
                    {a.triggeredChallenge && <span title="Triggered challenge" style={{ fontSize: 10 }}>⚔</span>}
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                ⚡ influenced decision &nbsp;·&nbsp; 🔍 unique signal &nbsp;·&nbsp; ⚔ triggered challenge
              </div>
            </div>
          )}

          {/* Footer stats */}
          <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.3)", borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
            Council ran {di.agentsRun} agent{di.agentsRun !== 1 ? "s" : ""}{di.runtimeMs ? ` in ${(di.runtimeMs / 1000).toFixed(1)}s` : ""} &nbsp;·&nbsp;
            {di.unresolvedObjection ? <span style={{ color: AMBER }}> unresolved objection</span> : " all objections addressed"}
          </div>
        </div>
      )}
    </div>
  );
}
// ── DecisionIntegritySection ───────────────────────────────────────────────────────────────
// ── PersonaLoadingGrid ───────────────────────────────────────────────────────────────
function PersonaLoadingGrid({ councilMode = "gcc", loadingStartedAt }: { councilMode?: CouncilModeType; loadingStartedAt?: React.MutableRefObject<number | null> }) {
  const personaOrder = PERSONA_ORDERS[councilMode] ?? PERSONA_ORDERS.gcc;
  const TOTAL_MS = 30_000;
  const SEQUENCE_MS = 28_000; // personas complete over first 28s
  const DELIBERATION_THRESHOLD_MS = TOTAL_MS - 5_000; // last 5s = deliberation

  const [elapsed, setElapsed] = useState(0);

  // Tick every 200ms to drive both the persona sequence and status message
  useEffect(() => {
    const start = loadingStartedAt?.current ?? Date.now();
    // Reset elapsed when councilMode changes (new submission)
    setElapsed(0);
    const timer = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 200);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [councilMode, loadingStartedAt]);

  // How many personas are "done" based on elapsed time (spread evenly over SEQUENCE_MS)
  const msPerPersona = SEQUENCE_MS / personaOrder.length;
  const doneCount = Math.min(personaOrder.length, Math.floor(elapsed / msPerPersona));
  // The currently active persona is the one right after the last done one
  const activeIdx = doneCount < personaOrder.length ? doneCount : -1;

  const allDone = doneCount >= personaOrder.length;
  const isDeliberating = elapsed >= DELIBERATION_THRESHOLD_MS;

  const modeLabel = councilMode === "global_vc" ? "GLOBAL VC COUNCIL"
    : councilMode === "india_pe" ? "INDIA PE / VC COUNCIL"
    : councilMode === "infrastructure" ? "INFRASTRUCTURE & PROJECT FINANCE COUNCIL"
    : councilMode === "gcc_equities" ? "GCC EQUITIES COUNCIL"
    : "GCC INVESTMENT COUNCIL";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: ACCENT, letterSpacing: "0.1em", marginBottom: 8 }}>
          CONVENING THE {modeLabel}
        </div>
        <div style={{ fontSize: 12, color: isDeliberating ? "#F59E0B" : TEXT2, transition: "color 0.6s" }}>
          {isDeliberating
            ? "Council is finalising its verdict..."
            : allDone
            ? "All advisors have submitted their analysis"
            : "10 specialist AI advisors are reviewing your deal memo"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {personaOrder.map((p, i) => {
          const meta = PERSONA_META[p.id as keyof typeof PERSONA_META] ?? { icon: "🤖", color: ACCENT };
          const isActive = i === activeIdx;
          const isDone = i < doneCount;
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

// ── Fix the Deal Panel ───────────────────────────────────────────────────────
// Shown for any REJECTED/VETOED/HOLD verdict.
// Calls the fixTheDeal LLM procedure and renders a 5-section deal repair report.
interface FixTheDealResult {
  classification: "A" | "B" | "C";
  classificationRationale: string;
  rootCauses: Array<{ category: string; description: string; priority: number }>;
  revisedBrief: string;
  changeSummaryTable: Array<{ change: string; original: string; revised: string; rootCauseAddressed: string; estimatedVoteImpact: string }>;
  predictedOutcome: { voteDistribution: string; consensusPct: number; decision: string; mostLikelyDissentingAgent: string; mostLikelyCondition: string };
  approvalSensitivityLadder: Array<{ structuralChange: string; estimatedVoteShift: string; runningVoteEstimate: string }>;
  residualRisks: string[];
}
function FixTheDealPanel({ result, councilMode, onRerun }: {
  result: CouncilResult;
  councilMode?: string;
  onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void;
}) {
  const isRejected = ["REJECTED", "VETOED", "HOLD"].includes(result.verdict);
  const [open, setOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [memoText, setMemoText] = useState<string | null>(null);

  const fixMutation = trpc.dealScreener.fixTheDeal.useMutation();
  const exportMutation = trpc.dealScreener.exportRepairBrief.useMutation();
  const memoMutation = trpc.dealScreener.requestRestructuringMemo.useMutation();

  if (!isRejected) return null;

  const handleFix = () => {
    if (open) { setOpen(false); return; }
    const outcome = `Verdict: ${result.verdict} · ${result.yesCount}/10 YES · Confidence: ${Math.round((result.confidenceScore ?? 0) * 100)}%\nTop blockers: ${(result.blockingIssues ?? []).slice(0, 3).join("; ")}`;
    const icSummary = result.icReport?.rawText?.slice(0, 2000) ?? "";
    fixMutation.mutate({
      dealText: result.dealText ?? result.dealTextPreview ?? "",
      councilOutcome: outcome,
      icMemoSummary: icSummary,
      councilMode: councilMode,
    });
    setOpen(true);
    setMemoText(null);
  };

  const handleDownloadPdf = async () => {
    if (!d || d.classification === "C") return;
    const dealName = result.dealName ?? "Deal";
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const filename = `${dealName.replace(/[^a-zA-Z0-9]/g, "_")}_RepairBrief_${dateStr}.pdf`;
    const res = await exportMutation.mutateAsync({
      dealName,
      councilMode: councilMode,
      classification: d.classification,
      classificationRationale: d.classificationRationale,
      rootCauses: d.rootCauses,
      revisedBrief: d.revisedBrief,
      changeSummaryTable: d.changeSummaryTable,
      predictedOutcome: d.predictedOutcome,
      approvalSensitivityLadder: d.approvalSensitivityLadder,
      residualRisks: d.residualRisks,
    });
    const blob = new Blob([Uint8Array.from(atob(res.pdfBase64), c => c.charCodeAt(0))], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRequestMemo = async () => {
    if (!d || d.classification !== "C") return;
    setMemoText(null);
    const blockers = d.rootCauses.slice(0, 3).map((rc: any) => `[${rc.category}] ${rc.description}`);
    const res = await memoMutation.mutateAsync({
      dealName: result.dealName ?? "Deal",
      classificationRationale: d.classificationRationale,
      structuralBlockers: blockers.length > 0 ? blockers : ["Fundamental structural deficiency identified by Council of 10"],
      councilMode: councilMode,
    });
    setMemoText(res.memo);
  };

  const handleRerun = () => {
    if (!fixMutation.data?.revisedBrief || !onRerun) return;
    setRerunning(true);
    onRerun(
      result.dealName + " [FIXED]",
      fixMutation.data.revisedBrief,
      (councilMode as CouncilModeType) ?? result.councilMode ?? "global_vc"
    );
    setTimeout(() => setRerunning(false), 2000);
  };

  const d = fixMutation.data as FixTheDealResult | undefined;
  const classColor = d?.classification === "A" ? GREEN : d?.classification === "B" ? AMBER : RED;
  const isClassC = d?.classification === "C";

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }} className="no-print">
      {/* Trigger button */}
      <button
        onClick={handleFix}
        disabled={fixMutation.isPending}
        style={{
          padding: "8px 18px",
          background: open ? "rgba(255,159,67,0.12)" : "none",
          border: `1px solid ${AMBER}`,
          color: AMBER,
          fontFamily: MONO, fontSize: 11, cursor: "pointer",
          borderRadius: 4, letterSpacing: "0.06em",
          opacity: fixMutation.isPending ? 0.7 : 1,
        }}
      >
        {fixMutation.isPending ? "ANALYSING DEAL..." : open ? "▲ CLOSE REPAIR REPORT" : "⚙ FIX THE DEAL"}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          marginTop: 12,
          background: "rgba(13,20,33,0.97)",
          border: `1px solid ${AMBER}44`,
          borderRadius: 8,
          padding: "20px 24px",
          boxShadow: `0 0 24px ${AMBER}12`,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.15em", marginBottom: 4 }}>DEAL REPAIR ENGINE · STRUCTURED ANALYSIS</div>
              <div style={{ fontFamily: MONO, fontSize: 14, color: AMBER, fontWeight: 700 }}>FIX THE DEAL</div>
            </div>
            {d && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>CLASSIFICATION</span>
                <span style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, color: classColor,
                  background: `${classColor}18`, border: `1px solid ${classColor}44`,
                  borderRadius: 4, padding: "3px 10px",
                }}>{d.classification} — {d.classification === "A" ? "STRUCTURALLY REPAIRABLE" : d.classification === "B" ? "CONDITIONALLY VIABLE" : "FUNDAMENTALLY NON-VIABLE"}</span>
              </div>
            )}
          </div>

          {/* Loading state */}
          {fixMutation.isPending && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, padding: "20px 0", textAlign: "center" }}>
              ANALYSING BLOCKING ISSUES · RECONSTRUCTING DEAL BRIEF · ESTIMATING VOTE IMPACT...
            </div>
          )}

          {/* Error state */}
          {fixMutation.isError && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: RED, padding: "12px 0" }}>
              ENGINE ERROR — {fixMutation.error?.message ?? "Unknown error"}
            </div>
          )}

          {/* Results */}
          {d && !fixMutation.isPending && (
            <>
              {/* ── CLASS C: FULL EARLY-EXIT PATH ─────────────────────────────────── */}
              {isClassC && (
                <>
                  {/* Red institutional warning banner */}
                  <div
                    data-testid="class-c-warning"
                    style={{
                      marginBottom: 20,
                      padding: "20px 22px",
                      background: "rgba(255,71,87,0.07)",
                      border: `2px solid ${RED}`,
                      borderLeft: `6px solid ${RED}`,
                      borderRadius: 6,
                    }}
                  >
                    {/* Header */}
                    <div style={{ fontFamily: MONO, fontSize: 13, color: RED, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                      THIS DEAL CANNOT BE REPAIRED
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: `${RED}cc`, letterSpacing: "0.04em", marginBottom: 14 }}>
                      Fundamental restructuring required before resubmission
                    </div>

                    {/* Classification rationale — verbatim, no truncation */}
                    <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, lineHeight: 1.7, marginBottom: 16, padding: "10px 14px", background: "rgba(255,71,87,0.05)", borderRadius: 4 }}>
                      {d.classificationRationale}
                    </div>

                    {/* Structural changes required to reach Class B */}
                    {d.rootCauses.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>
                          STRUCTURAL CHANGES REQUIRED TO REACH CLASS B VIABILITY
                        </div>
                        {d.rootCauses.slice(0, 3).map((rc: any, i: number) => (
                          <div key={i} style={{
                            display: "flex", gap: 10, alignItems: "flex-start",
                            padding: "8px 12px", marginBottom: 4,
                            background: "rgba(255,71,87,0.05)",
                            borderLeft: `3px solid ${RED}66`,
                            borderRadius: 3,
                          }}>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: RED, fontWeight: 700, minWidth: 20, paddingTop: 1 }}>{i + 1}.</span>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, minWidth: 28, paddingTop: 1 }}>[{rc.category}]</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, lineHeight: 1.5 }}>{rc.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommended alternatives */}
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>RECOMMENDED ALTERNATIVES</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {["Phased entry", "Smaller ticket", "Different financing structure", "Strategic partnership", "Alternative instrument", "Hold / wait strategy"].map(alt => (
                          <span key={alt} style={{
                            fontFamily: MONO, fontSize: 9, color: AMBER,
                            background: `${AMBER}12`, border: `1px solid ${AMBER}33`,
                            borderRadius: 4, padding: "3px 8px",
                          }}>{alt}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* REQUEST RESTRUCTURING MEMO button */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      onClick={handleRequestMemo}
                      disabled={memoMutation.isPending}
                      data-testid="request-restructuring-memo"
                      style={{
                        padding: "9px 20px",
                        background: memoMutation.isPending ? "rgba(255,71,87,0.08)" : "rgba(255,71,87,0.12)",
                        border: `1px solid ${RED}`,
                        color: RED,
                        fontFamily: MONO, fontSize: 11, cursor: memoMutation.isPending ? "not-allowed" : "pointer",
                        borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                        opacity: memoMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {memoMutation.isPending ? "GENERATING MEMO..." : "REQUEST RESTRUCTURING MEMO"}
                    </button>
                    {memoMutation.isError && (
                      <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>
                        Memo generation failed — {memoMutation.error?.message ?? "Unknown error"}
                      </span>
                    )}
                  </div>

                  {/* Restructuring memo output */}
                  {memoText && (
                    <div style={{
                      marginTop: 16,
                      padding: "16px 20px",
                      background: "rgba(13,20,33,0.98)",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                    }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 10 }}>
                        RESTRUCTURING MEMO — IC PARTNER TO SPONSOR
                      </div>
                      <pre style={{
                        fontFamily: MONO, fontSize: 10, color: TEXT2,
                        lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        margin: 0,
                      }}>{memoText}</pre>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                        AI-assisted deal analysis. Not investment advice. © AgenThink Mesh.
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── CLASS A / B: FULL REPAIR REPORT ──────────────────────────────── */}
              {!isClassC && (
                <>
                  {/* Classification rationale */}
                  <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 16, lineHeight: 1.6, padding: "10px 14px", background: `${classColor}08`, borderRadius: 6, borderLeft: `3px solid ${classColor}` }}>
                    {d.classificationRationale}
                  </div>

                  {/* Root cause triage */}
                  {d.rootCauses.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>ROOT CAUSE TRIAGE</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {d.rootCauses.map((rc: any, i: number) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: AMBER, fontWeight: 700, minWidth: 20, paddingTop: 1 }}>#{rc.priority}</span>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, minWidth: 28, paddingTop: 1 }}>[{rc.category}]</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, lineHeight: 1.5 }}>{rc.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Change audit table */}
                  {d.changeSummaryTable.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>CHANGE AUDIT TABLE</div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 10 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                              {["CHANGE", "ORIGINAL", "REVISED", "ROOT CAUSE", "VOTE IMPACT"].map(h => (
                                <th key={h} style={{ padding: "6px 10px", color: MUTED, fontWeight: 600, textAlign: "left", letterSpacing: "0.08em", fontSize: 9 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {d.changeSummaryTable.map((row: any, i: number) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                                <td style={{ padding: "7px 10px", color: TEXT, lineHeight: 1.4 }}>{row.change}</td>
                                <td style={{ padding: "7px 10px", color: RED, lineHeight: 1.4 }}>{row.original}</td>
                                <td style={{ padding: "7px 10px", color: GREEN, lineHeight: 1.4 }}>{row.revised}</td>
                                <td style={{ padding: "7px 10px", color: ACCENT, lineHeight: 1.4 }}>{row.rootCauseAddressed}</td>
                                <td style={{ padding: "7px 10px", color: AMBER, lineHeight: 1.4, fontWeight: 700 }}>{row.estimatedVoteImpact}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Predicted outcome */}
                  {d.predictedOutcome && (
                    <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(0,255,135,0.04)", border: `1px solid ${GREEN}22`, borderRadius: 6 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>PREDICTED OUTCOME AFTER FIXES</div>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>DECISION</div>
                          <div style={{ fontFamily: MONO, fontSize: 13, color: GREEN, fontWeight: 700 }}>{d.predictedOutcome.decision}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>VOTE DISTRIBUTION</div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{d.predictedOutcome.voteDistribution}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>CONSENSUS</div>
                          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>{d.predictedOutcome.consensusPct}%</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 2 }}>LIKELY CONDITION</div>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER }}>{d.predictedOutcome.mostLikelyCondition}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Approval sensitivity ladder */}
                  {d.approvalSensitivityLadder.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>APPROVAL SENSITIVITY LADDER</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {d.approvalSensitivityLadder.map((step: any, i: number) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                            <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, minWidth: 16 }}>{i + 1}.</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, flex: 1, lineHeight: 1.4 }}>{step.structuralChange}</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN, minWidth: 60, textAlign: "right" }}>{step.estimatedVoteShift}</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, minWidth: 70, textAlign: "right" }}>→ {step.runningVoteEstimate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Residual risks */}
                  {d.residualRisks.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>RESIDUAL RISKS (AFTER FIXES)</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {d.residualRisks.map((risk: string, i: number) => (
                          <div key={i} style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, padding: "4px 10px", borderLeft: `2px solid ${RED}44` }}>{risk}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Revised brief + Rerun button */}
                  {d.revisedBrief && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em" }}>REVISED DEAL BRIEF (INLINE CHANGES MARKED)</div>
                        {onRerun && (
                          <button
                            onClick={handleRerun}
                            disabled={rerunning}
                            style={{
                              padding: "7px 16px",
                              background: rerunning ? "rgba(0,255,135,0.12)" : "rgba(0,255,135,0.08)",
                              border: `1px solid ${GREEN}`,
                              color: GREEN,
                              fontFamily: MONO, fontSize: 11, cursor: "pointer",
                              borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                            }}
                          >
                            {rerunning ? "SUBMITTING TO COUNCIL..." : "↻ RERUN WITH FIXES"}
                          </button>
                        )}
                      </div>
                      <pre style={{
                        fontFamily: MONO, fontSize: 10, color: TEXT2,
                        background: "rgba(255,255,255,0.02)", borderRadius: 6,
                        padding: "12px 14px", maxHeight: 320, overflowY: "auto",
                        lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>{d.revisedBrief}</pre>
                    </div>
                  )}

                  {/* DOWNLOAD REPAIR BRIEF button — Class A and B only */}
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={handleDownloadPdf}
                      disabled={exportMutation.isPending}
                      data-testid="download-repair-brief"
                      style={{
                        padding: "9px 20px",
                        background: exportMutation.isPending ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.12)",
                        border: `1px solid ${AMBER}`,
                        color: AMBER,
                        fontFamily: MONO, fontSize: 11, cursor: exportMutation.isPending ? "not-allowed" : "pointer",
                        borderRadius: 4, letterSpacing: "0.06em", fontWeight: 700,
                        opacity: exportMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {exportMutation.isPending ? "GENERATING PDF..." : "DOWNLOAD REPAIR BRIEF"}
                    </button>
                    {exportMutation.isError && (
                      <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>
                        PDF export failed — {exportMutation.error?.message ?? "Unknown error"}
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Infrastructure Conditions to Re-engage Panel ─────────────────────────────
// Shown only in infrastructure mode when verdict is REJECT or VETOED.
// Derives structured re-engagement criteria from the council's upgrade triggers
// and the blocking issues, formatted as an institutional checklist table.
function InfraReEngagePanel({ result }: { result: CouncilResult }) {
  const isRejectOrVeto = result.verdict === "REJECTED" || result.verdict === "VETOED";

  // ── Re-run state ────────────────────────────────────────────────────────────
  const [rerunResult, setRerunResult] = useState<null | {
    originalVerdict: string;
    originalConfidence: number;
    originalBlockers: string[];
    updatedVerdict: string;
    updatedConfidence: number;
    updatedBlockers: string[];
    updatedYesCount: number;
    updatedNoCount: number;
    deltaLabel: string;
    whatImproved: string[];
    risksRemaining: string[];
    councilMode: string;
    assumptionsApplied: Record<string, unknown>;
  }>(null);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const rerunMutation = trpc.dealScreener.rerunWithUpdatedTerms.useMutation({
    onSuccess: (data) => { setRerunResult(data); setRerunError(null); },
    onError: (err) => { setRerunError(err.message ?? "Re-run failed"); },
  });

  if (!isRejectOrVeto) return null;

  // Build structured conditions from blockingIssues + conditionsToProceed
  // Each condition gets a threshold, rationale, and impact estimate
  const conditions: Array<{ condition: string; threshold: string; rationale: string; impact: string }> = [];

  // Parse known Helios-North / infrastructure patterns from blocking issues
  const allText = [...(result.blockingIssues ?? []), ...(result.conditionsToProceed ?? [])].join(" ").toLowerCase();

  if (allText.includes("cfd") || allText.includes("strike") || allText.includes("£73") || allText.includes("contract for difference")) {
    conditions.push({
      condition: "CfD Strike Price",
      threshold: "≥ £85/MWh (AR7 mid-range)",
      rationale: "Current £73/MWh is below fund IRR threshold; AR7 outcome required to close gap",
      impact: "Approval probability +25–35%",
    });
  }
  if (allText.includes("contingency") || allText.includes("1.7%") || allText.includes("low contingency")) {
    conditions.push({
      condition: "Construction Contingency",
      threshold: "≥ 5% of CAPEX",
      rationale: "1.7% is dangerously low for FOAK floating foundation technology",
      impact: "Approval probability +15–20%",
    });
  }
  if (allText.includes("foundation") || allText.includes("floating") || allText.includes("foak") || allText.includes("first-of-kind") || allText.includes("unvalidated")) {
    conditions.push({
      condition: "Floating Foundation Validation",
      threshold: "Independent engineering validation at commercial scale",
      rationale: "No track record at commercial scale; TRL <7 is a hard blocker for project finance",
      impact: "Approval probability +30–40%",
    });
  }
  if (allText.includes("epc") || allText.includes("contractor") || allText.includes("fixed-price") || allText.includes("open-book")) {
    conditions.push({
      condition: "EPC Contract",
      threshold: "Committed fixed-price EPC with LD backstop",
      rationale: "Open-book EPC transfers construction risk to sponsor; unacceptable for FOAK technology",
      impact: "Approval probability +20–25%",
    });
  }
  if (allText.includes("merchant") || allText.includes("unhedged") || allText.includes("20%") || allText.includes("offtake")) {
    conditions.push({
      condition: "Merchant Exposure",
      threshold: "≤ 10% uncontracted revenue",
      rationale: "20% merchant exposure creates material downside risk in a price-volatile market",
      impact: "Approval probability +10–15%",
    });
  }

  // Fallback: derive from conditionsToProceed if no pattern matched
  if (conditions.length === 0 && result.conditionsToProceed?.length) {
    result.conditionsToProceed.slice(0, 5).forEach(c => {
      conditions.push({
        condition: c.length > 60 ? c.slice(0, 60) + "…" : c,
        threshold: "As specified by council",
        rationale: c,
        impact: "Required for re-engagement",
      });
    });
  }

  if (conditions.length === 0) return null;

  // Determine the Helios-North updated assumptions from the conditions detected
  const hasCfd = conditions.some(c => c.condition === "CfD Strike Price");
  const hasContingency = conditions.some(c => c.condition === "Construction Contingency");
  const hasFoundation = conditions.some(c => c.condition === "Floating Foundation Validation");
  const hasEpc = conditions.some(c => c.condition === "EPC Contract");
  const hasMerchant = conditions.some(c => c.condition === "Merchant Exposure");

  function handleRerun() {
    const dealText = result.dealText ?? result.dealTextPreview ?? "";
    if (!dealText.trim()) {
      setRerunError("Original deal text not available for re-run. Please re-submit the deal.");
      return;
    }
    setRerunResult(null);
    setRerunError(null);
    rerunMutation.mutate({
      originalDealText: dealText,
      originalVerdict: result.verdict,
      originalConfidence: result.confidenceScore,
      originalBlockers: result.blockingIssues ?? [],
      updatedAssumptions: {
        cfdStrikeGbpMwh: hasCfd ? 85 : undefined,
        contingencyPct: hasContingency ? 5 : undefined,
        merchantExposurePct: hasMerchant ? 10 : undefined,
        fixedPriceEpc: hasEpc ? true : undefined,
        foundationValidated: hasFoundation ? true : undefined,
      },
    });
  }

  // Verdict color helper
  function verdictColor(v: string) {
    if (v === "APPROVED") return GREEN;
    if (v === "APPROVED_WITH_CONDITIONS") return ACCENT;
    return RED;
  }

  // Delta label color
  const deltaColor = rerunResult
    ? rerunResult.deltaLabel.startsWith("IMPROVED") || rerunResult.deltaLabel.startsWith("SIGNIFICANT")
      ? GREEN
      : rerunResult.deltaLabel.startsWith("UNCHANGED")
      ? AMBER
      : RED
    : MUTED;

  return (
    <div style={{
      background: "rgba(255,159,67,0.04)",
      border: "1px solid rgba(255,159,67,0.35)",
      borderRadius: 8,
      padding: "20px 24px",
      marginBottom: 20,
      marginTop: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 3, height: 32, background: "#ff9f43", borderRadius: 2, flexShrink: 0,
        }} />
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "#ff9f43", letterSpacing: "0.12em", marginBottom: 2 }}>
            CONDITIONS TO RE-ENGAGE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.06em" }}>
            INFRASTRUCTURE / PROJECT FINANCE COUNCIL · INSTITUTIONAL RE-ENGAGEMENT CRITERIA
          </div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 9, color: "rgba(255,159,67,0.7)", background: "rgba(255,159,67,0.08)", border: "1px solid rgba(255,159,67,0.25)", borderRadius: 3, padding: "3px 8px" }}>
          {conditions.length} CRITERIA
        </div>
      </div>

      {/* Table header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1.6fr 2fr 1fr",
        gap: 8,
        padding: "6px 10px",
        background: "rgba(255,159,67,0.08)",
        borderRadius: 4,
        marginBottom: 6,
      }}>
        {["CONDITION", "THRESHOLD", "RATIONALE", "APPROVAL IMPACT"].map(h => (
          <div key={h} style={{ fontFamily: MONO, fontSize: 8, color: "#ff9f43", fontWeight: 700, letterSpacing: "0.1em" }}>{h}</div>
        ))}
      </div>

      {/* Table rows */}
      {conditions.map((c, i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1.6fr 2fr 1fr",
          gap: 8,
          padding: "8px 10px",
          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
          borderBottom: i < conditions.length - 1 ? `1px solid rgba(255,159,67,0.1)` : "none",
          alignItems: "start",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT, fontWeight: 700, lineHeight: 1.4 }}>{c.condition}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "#ff9f43", lineHeight: 1.4 }}>{c.threshold}</div>
          <div style={{ fontSize: 11, color: TEXT2, lineHeight: 1.5 }}>{c.rationale}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, lineHeight: 1.4 }}>{c.impact}</div>
        </div>
      ))}

      {/* Footer note */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,159,67,0.15)", fontFamily: MONO, fontSize: 9, color: MUTED, lineHeight: 1.5 }}>
        ℹ All conditions must be met concurrently for re-engagement. Meeting individual conditions in isolation does not guarantee approval.
        Re-submit the updated deal memo to the Infrastructure / Project Finance Council for a fresh evaluation.
      </div>

      {/* ── RE-RUN WITH UPDATED TERMS ─────────────────────────────────────── */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,159,67,0.2)" }}>
        {/* Section label */}
        <div style={{ fontFamily: MONO, fontSize: 9, color: "rgba(255,159,67,0.6)", letterSpacing: "0.1em", marginBottom: 10 }}>
          SENSITIVITY ANALYSIS · UPDATED TERMS SCENARIO
        </div>

        {/* Assumptions summary */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {hasCfd && <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "2px 7px" }}>CfD → £85/MWh</span>}
          {hasContingency && <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "2px 7px" }}>Contingency → 5%</span>}
          {hasMerchant && <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "2px 7px" }}>Merchant → 10%</span>}
          {hasEpc && <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "2px 7px" }}>Fixed-Price EPC</span>}
          {hasFoundation && <span style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, padding: "2px 7px" }}>Foundation Validated</span>}
        </div>

        {/* Re-run button */}
        {!rerunResult && (
          <button
            onClick={handleRerun}
            disabled={rerunMutation.isPending}
            style={{
              padding: "9px 20px",
              background: rerunMutation.isPending ? "rgba(255,159,67,0.12)" : "rgba(255,159,67,0.15)",
              border: `1px solid ${rerunMutation.isPending ? "rgba(255,159,67,0.3)" : "#ff9f43"}`,
              color: rerunMutation.isPending ? "rgba(255,159,67,0.5)" : "#ff9f43",
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              cursor: rerunMutation.isPending ? "not-allowed" : "pointer",
              borderRadius: 4, letterSpacing: "0.08em",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {rerunMutation.isPending ? (
              <>
                <span style={{ display: "inline-block", width: 10, height: 10, border: "1.5px solid rgba(255,159,67,0.4)", borderTopColor: "#ff9f43", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                COUNCIL RE-EVALUATING…
              </>
            ) : (
              <>↺ RE-RUN WITH UPDATED TERMS</>
            )}
          </button>
        )}

        {/* Error */}
        {rerunError && (
          <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, color: RED }}>
            ⚠ {rerunError}
          </div>
        )}

        {/* ── COMPARISON CARD ── */}
        {rerunResult && (
          <div style={{ marginTop: 12 }}>
            {/* Delta banner */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px",
              background: `rgba(${rerunResult.deltaLabel.startsWith("IMPROVED") || rerunResult.deltaLabel.startsWith("SIGNIFICANT") ? "0,255,135" : rerunResult.deltaLabel.startsWith("UNCHANGED") ? "255,159,67" : "255,71,87"},0.07)`,
              border: `1px solid ${deltaColor}`,
              borderRadius: 6, marginBottom: 12,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: deltaColor, letterSpacing: "0.08em" }}>
                {rerunResult.deltaLabel}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginLeft: "auto" }}>
                UPDATED TERMS SCENARIO · INFRASTRUCTURE / PROJECT FINANCE COUNCIL
              </div>
            </div>

            {/* Side-by-side verdict comparison */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {/* Original */}
              <div style={{ background: "rgba(255,71,87,0.04)", border: "1px solid rgba(255,71,87,0.25)", borderRadius: 6, padding: "12px 14px" }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.1em", marginBottom: 8 }}>ORIGINAL SUBMISSION</div>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: verdictColor(rerunResult.originalVerdict), marginBottom: 4 }}>
                  {rerunResult.originalVerdict.replace(/_/g, " ")}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 8 }}>
                  Confidence: {Math.round(rerunResult.originalConfidence)}%
                </div>
                {rerunResult.originalBlockers.slice(0, 3).map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "start", marginBottom: 3 }}>
                    <span style={{ color: RED, fontSize: 9, flexShrink: 0, marginTop: 1 }}>●</span>
                    <span style={{ fontSize: 10, color: TEXT2, lineHeight: 1.4 }}>{b.length > 80 ? b.slice(0, 80) + "…" : b}</span>
                  </div>
                ))}
              </div>

              {/* Updated */}
              <div style={{ background: `rgba(${rerunResult.updatedVerdict === "APPROVED" ? "0,255,135" : rerunResult.updatedVerdict === "APPROVED_WITH_CONDITIONS" ? "74,158,255" : "255,71,87"},0.04)`, border: `1px solid ${verdictColor(rerunResult.updatedVerdict)}40`, borderRadius: 6, padding: "12px 14px" }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.1em", marginBottom: 8 }}>UPDATED TERMS SCENARIO</div>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: verdictColor(rerunResult.updatedVerdict), marginBottom: 4 }}>
                  {rerunResult.updatedVerdict.replace(/_/g, " ")}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 8 }}>
                  Confidence: {Math.round(rerunResult.updatedConfidence)}%
                  &nbsp;&middot;&nbsp;{rerunResult.updatedYesCount}/10 YES
                </div>
                {rerunResult.updatedBlockers.slice(0, 3).map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "start", marginBottom: 3 }}>
                    <span style={{ color: AMBER, fontSize: 9, flexShrink: 0, marginTop: 1 }}>●</span>
                    <span style={{ fontSize: 10, color: TEXT2, lineHeight: 1.4 }}>{b.length > 80 ? b.slice(0, 80) + "…" : b}</span>
                  </div>
                ))}
                {rerunResult.updatedBlockers.length === 0 && (
                  <div style={{ fontSize: 10, color: GREEN }}>No blocking issues identified</div>
                )}
              </div>
            </div>

            {/* What improved */}
            {rerunResult.whatImproved.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: GREEN, letterSpacing: "0.1em", marginBottom: 6 }}>WHAT IMPROVED</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {rerunResult.whatImproved.map((item, i) => (
                    <span key={i} style={{ fontFamily: MONO, fontSize: 9, color: GREEN, background: "rgba(0,255,135,0.06)", border: "1px solid rgba(0,255,135,0.2)", borderRadius: 3, padding: "2px 7px" }}>
                      ✓ {item.length > 60 ? item.slice(0, 60) + "…" : item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Risks remaining */}
            {rerunResult.risksRemaining.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: AMBER, letterSpacing: "0.1em", marginBottom: 6 }}>RISKS REMAINING</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {rerunResult.risksRemaining.slice(0, 4).map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "start" }}>
                      <span style={{ color: AMBER, fontSize: 9, flexShrink: 0, marginTop: 1 }}>▶</span>
                      <span style={{ fontSize: 10, color: TEXT2, lineHeight: 1.4 }}>{r.length > 100 ? r.slice(0, 100) + "…" : r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Re-run again button */}
            <button
              onClick={() => { setRerunResult(null); setRerunError(null); }}
              style={{
                marginTop: 4, padding: "6px 14px",
                background: "none", border: `1px solid ${MUTED}`,
                color: MUTED, fontFamily: MONO, fontSize: 9,
                cursor: "pointer", borderRadius: 3, letterSpacing: "0.06em",
              }}
            >
              ↺ RESET
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardroomICReport({ ic, result, onCopy, onNewDeal, patternContext, stressTested, councilMode, onRerun }: { ic: ICReportData; result: CouncilResult; onCopy: (text: string) => void; onNewDeal: () => void; patternContext?: "invested_match" | "passed_match"; stressTested?: boolean; councilMode?: string; onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void }) {
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
        background: `linear-gradient(135deg, ${verdictColor}0d 0%, rgba(13,20,33,0.95) 100%)`,
        border: `1px solid ${verdictColor}55`,
        borderRadius: 10,
        padding: "20px 26px",
        marginBottom: 20,
        position: "relative" as const,
        overflow: "hidden" as const,
        boxShadow: `0 0 32px ${verdictColor}18`,
      }}>
        {/* Verdict accent line */}
        <div style={{
          position: "absolute" as const, top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${verdictColor}, transparent)`,
          borderRadius: "10px 10px 0 0",
        }} />
        {/* Top row: label + date */}
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.15em" }}>DEAL SCREENER · IC DECISION MEMO</div>
            {/* Mode coherence badge — shown prominently for infrastructure mode */}
            {result.councilMode === "infrastructure" && (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 700,
                color: "#ff9f43",
                background: "rgba(255,159,67,0.1)",
                border: "1px solid rgba(255,159,67,0.4)",
                borderRadius: 3,
                padding: "2px 8px",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap" as const,
              }}>
                ⚡ INFRASTRUCTURE / PROJECT FINANCE COUNCIL · 10-AGENT COUNCIL
              </span>
            )}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>
            {new Date(result.createdAt ?? Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          </div>
        </div>
        {/* Bottom row: deal info + confidence + verdict badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 8 }}>{result.dealName}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.3)",
                color: GREEN, padding: "2px 8px", borderRadius: 3, letterSpacing: "0.08em",
              }}>{result.yesCount} YES</span>
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                background: "rgba(255,71,87,0.1)", border: "1px solid rgba(255,71,87,0.3)",
                color: RED, padding: "2px 8px", borderRadius: 3, letterSpacing: "0.08em",
              }}>{result.noCount} NO</span>
              <span
                title={`${result.yesCount} YES / ${result.noCount} NO — ${Math.round(yesPct * 100)}% council agreement`}
                style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  background: `${confidenceColor}18`, border: `1px solid ${confidenceColor}55`,
                  color: confidenceColor, padding: "2px 8px", borderRadius: 3,
                  letterSpacing: "0.08em", cursor: "help",
                }}>CONFIDENCE: {confidenceLabel}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <VerdictBadge verdict={result.verdict} />
              {stressTested && (
                <span
                  title="Strategic Scenario Simulation completed for this deal."
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 3,
                    background: "rgba(168,85,247,0.15)",
                    border: "1px solid rgba(168,85,247,0.55)",
                    color: "#a855f7",
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    cursor: "help",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚡ STRESS-TESTED
                </span>
              )}
            </div>
            {result.decisionIntegrity != null && (
              <DisagreementBadge count={result.decisionIntegrity.disagreementCount ?? 0} />
            )}
          </div>
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
        {/* Pattern context sentence — injected as first line of executive summary when present */}
        {patternContext === "invested_match" && (
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: GREEN, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, flexShrink: 0 }}>●</span>
            Historical pattern context: this deal matches prior invested opportunities with similar strengths.
          </p>
        )}
        {patternContext === "passed_match" && (
          <p style={{ margin: "0 0 10px 0", fontSize: 12, color: AMBER, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, flexShrink: 0 }}>●</span>
            Historical pattern context: similar opportunities with this pattern were previously passed.
          </p>
        )}
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
          {ic.keyRisks.map((r, i) => {
            const rLow = r.toLowerCase();
            const sev = rLow.includes("critical") || rLow.includes("fatal") || rLow.includes("veto") || rLow.includes("block") ? "HIGH"
              : rLow.includes("moderate") || rLow.includes("concern") || rLow.includes("uncertain") || rLow.includes("limited") ? "MEDIUM"
              : "LOW";
            const sevColor = sev === "HIGH" ? RED : sev === "MEDIUM" ? AMBER : GREEN;
            const sevBg = sev === "HIGH" ? "rgba(255,71,87,0.12)" : sev === "MEDIUM" ? "rgba(255,159,67,0.10)" : "rgba(0,255,135,0.08)";
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${RED}`, lineHeight: 1.5 }}>
                <span style={{ flex: 1, fontSize: 12, color: TEXT2 }}>{r}</span>
                <span style={{
                  flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  background: sevBg, border: `1px solid ${sevColor}55`,
                  color: sevColor, padding: "1px 6px", borderRadius: 3, letterSpacing: "0.08em", marginTop: 2,
                }}>{sev}</span>
              </div>
            );
          })}
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
        {(ic.consensusBreakdown.keyDisagreements ?? []).length > 0 && (
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

      {/* Decision Confidence & Limitations — shown when decisionConfidence is present */}
      {ic.decisionConfidence && (
        <div style={{ background: BG2, border: `1px solid ${
          ic.decisionConfidence.level === "HIGH" ? "rgba(0,255,135,0.3)"
          : ic.decisionConfidence.level === "MEDIUM" ? "rgba(74,158,255,0.3)"
          : "rgba(255,159,67,0.3)"
        }`, borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.12em" }}>9. DECISION CONFIDENCE</div>
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              color: ic.decisionConfidence.level === "HIGH" ? GREEN : ic.decisionConfidence.level === "MEDIUM" ? ACCENT : AMBER,
              background: ic.decisionConfidence.level === "HIGH" ? "rgba(0,255,135,0.12)" : ic.decisionConfidence.level === "MEDIUM" ? "rgba(74,158,255,0.12)" : "rgba(255,159,67,0.12)",
              border: `1px solid ${ic.decisionConfidence.level === "HIGH" ? "rgba(0,255,135,0.35)" : ic.decisionConfidence.level === "MEDIUM" ? "rgba(74,158,255,0.35)" : "rgba(255,159,67,0.35)"}`,
              padding: "2px 10px", borderRadius: 3, letterSpacing: "0.08em",
            }}>{ic.decisionConfidence.level}</span>
          </div>
          {(ic.decisionConfidence.limitations ?? []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: AMBER, marginBottom: 6, letterSpacing: "0.08em" }}>LIMITATIONS</div>
              {(ic.decisionConfidence.limitations ?? []).map((l, i) => (
                <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${AMBER}`, lineHeight: 1.5 }}>⚠ {l}</div>
              ))}
            </div>
          )}
          {(ic.decisionConfidence.dataGaps ?? []).length > 0 && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: RED, marginBottom: 6, letterSpacing: "0.08em" }}>DATA GAPS</div>
              {(ic.decisionConfidence.dataGaps ?? []).map((g, i) => (
                <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${RED}`, lineHeight: 1.5 }}>✗ {g}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grounded Facts vs Inferred Insights */}
      {((ic.groundedFacts && (ic.groundedFacts ?? []).length > 0) || (ic.inferredInsights && (ic.inferredInsights ?? []).length > 0)) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {ic.groundedFacts && (ic.groundedFacts ?? []).length > 0 && (
            <div style={{ background: BG2, border: `1px solid rgba(0,255,135,0.2)`, borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: "0.12em", marginBottom: 12 }}>10. GROUNDED FACTS</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 8 }}>Directly supported by submitted data</div>
              {ic.groundedFacts.map((f, i) => (
                <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${GREEN}`, lineHeight: 1.5 }}>✓ {f}</div>
              ))}
            </div>
          )}
          {ic.inferredInsights && (ic.inferredInsights ?? []).length > 0 && (
            <div style={{ background: BG2, border: `1px solid rgba(74,158,255,0.2)`, borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 12 }}>11. INFERRED INSIGHTS</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 8 }}>Analyst inference — not directly stated in data</div>
              {ic.inferredInsights.map((ins, i) => (
                <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${ACCENT}`, lineHeight: 1.5 }}>~ {ins}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* What Would Change This Decision — section 12 */}
      {ic.whatWouldChangeDecision && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, letterSpacing: "0.12em", marginBottom: 16 }}>12. WHAT WOULD CHANGE THIS DECISION</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {ic.whatWouldChangeDecision?.upgradeFactors && (ic.whatWouldChangeDecision.upgradeFactors ?? []).length > 0 && (
              <div style={{ background: "rgba(0,255,135,0.04)", border: "1px solid rgba(0,255,135,0.18)", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: GREEN, letterSpacing: "0.1em", marginBottom: 10 }}>UPGRADE FACTORS</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 8 }}>Would make this a stronger YES</div>
                {ic.whatWouldChangeDecision.upgradeFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${GREEN}`, lineHeight: 1.5 }}>↑ {f}</div>
                ))}
              </div>
            )}
            {ic.whatWouldChangeDecision?.downgradeFactors && (ic.whatWouldChangeDecision.downgradeFactors ?? []).length > 0 && (
              <div style={{ background: "rgba(255,68,68,0.04)", border: "1px solid rgba(255,68,68,0.18)", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: RED, letterSpacing: "0.1em", marginBottom: 10 }}>DOWNGRADE FACTORS</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 8 }}>Would flip this to a NO</div>
                {ic.whatWouldChangeDecision.downgradeFactors.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${RED}`, lineHeight: 1.5 }}>↓ {f}</div>
                ))}
              </div>
            )}
            {ic.whatWouldChangeDecision?.keyMonitoringMetrics && (ic.whatWouldChangeDecision.keyMonitoringMetrics ?? []).length > 0 && (
              <div style={{ background: "rgba(255,159,67,0.04)", border: "1px solid rgba(255,159,67,0.18)", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: AMBER, letterSpacing: "0.1em", marginBottom: 10 }}>KEY MONITORING METRICS</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 8 }}>Watch these post-investment</div>
                {ic.whatWouldChangeDecision.keyMonitoringMetrics.map((m, i) => (
                  <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${AMBER}`, lineHeight: 1.5 }}>◎ {m}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Infrastructure Conditions to Re-engage Panel — shown only in infrastructure mode for rejected/vetoed deals */}
      {result.councilMode === "infrastructure" && (
        <InfraReEngagePanel result={result} />
      )}

      {/* Fix the Deal button + panel */}
      <FixTheDealPanel result={result} councilMode={councilMode} onRerun={onRerun} />

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
          ⍘ COPY IC REPORT
        </button>
      </div>
    </div>
  );
}

// ── IC Report (raw Council output + boardroom IC Report tabs) ─────────────────
function ICReport({ result, onNewDeal, councilMode: councilModeProp, onRerun, isHistoryView, patternContext }: { result: CouncilResult; onNewDeal: () => void; councilMode?: CouncilModeType; onRerun?: (dealName: string, dealText: string, mode: CouncilModeType) => void; isHistoryView?: boolean; patternContext?: "invested_match" | "passed_match" }) {
  const [activeTab, setActiveTab] = useState<"raw" | "boardroom">(result.icReport ? "boardroom" : "raw");
  // ── Re-run modal state ────────────────────────────────────────────────────
  const [rerunOpen, setRerunOpen] = useState(false);
  // Pre-fill with dealTextPreview if available (first 200 chars stored for Re-run UX)
  const [rerunText, setRerunText] = useState(result.dealTextPreview ?? "");
  const [rerunMode, setRerunMode] = useState<CouncilModeType>(result.councilMode ?? councilModeProp ?? "global_vc");
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [icMemoLoading, setIcMemoLoading] = useState(false);
  const [icMemoError, setIcMemoError] = useState<string | null>(null);
  const [icMemoStatus, setIcMemoStatus] = useState<"idle" | "synthesising" | "rendering" | "done">("idle");
  // Stage auto-advance: set to true once pitch.updateStage(ic_ready) fires after IC Memo generation
  const [movedToIcReady, setMovedToIcReady] = useState(false);
  const stageAdvancedRef = React.useRef(false); // idempotency guard — only fires once per mount

  const icMemoPdfMutation = trpc.dealScreener.icMemoPdf.useMutation();
  const createShare = trpc.shareReport.create.useMutation();
  const updateTriageStage = trpc.pitch.updateStage.useMutation();

  // ── Stress-tested badge: check if a completed simulation exists ───────────
  const { data: simBadgeData } = trpc.scenarioSim.hasCompletedSim.useQuery(
    { dealId: result.dealId ?? "" },
    { enabled: !!result.dealId, staleTime: 30_000 }
  );

  // ── Reports Panel: lift protocol/delta state from DecisionUpgradePanel ────
  const [liftedProtocol, setLiftedProtocol] = useState<any>(null);
  const [liftedDelta, setLiftedDelta] = useState<any>(null);

  // ── Reports Panel: live sim data (set via onSimCompleted callback from ScenarioSimDashboard)
  const [liveSimData, setLiveSimData] = useState<{
    runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any;
  } | null>(null);

  const handleSimCompleted = (data: { runId: string; mode: string; targetCount: number; completedAt: string; aggregation: any }) => {
    setLiveSimData(data);
  };

  // ── Reports Panel: DB fallback — fetch latest completed simulation for stress test export
  const { data: latestSimRuns } = trpc.scenarioSim.listRunsForDeal.useQuery(
    { dealId: result.dealId ?? "" },
    { enabled: !!result.dealId && !liveSimData, staleTime: 30_000 }
  );
  const latestCompletedSim = latestSimRuns?.find((r: any) => r.status === "completed") ?? null;
  const { data: latestSimStatus } = trpc.scenarioSim.getRunStatus.useQuery(
    { runId: latestCompletedSim?.runId ?? "" },
    { enabled: !!latestCompletedSim?.runId && !liveSimData, staleTime: 60_000 }
  );

  // Merge: prefer live data (just completed), fall back to DB-fetched
  const effectiveSimData = liveSimData ?? (
    latestSimStatus?.status === "completed" && latestSimStatus.aggregation
      ? {
          runId:       latestSimStatus.runId,
          mode:        latestSimStatus.mode,
          targetCount: latestSimStatus.targetCount,
          completedAt: latestSimStatus.completedAt ? (latestSimStatus.completedAt instanceof Date ? latestSimStatus.completedAt.toISOString() : String(latestSimStatus.completedAt)) : "",
          aggregation: latestSimStatus.aggregation,
        }
      : null
  );

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
        councilMode:         councilModeProp ?? result.councilMode,
        patternContext:      patternContext,
        dealId:              result.dealId,
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

      // ── Stage auto-advance: ENGAGE → IC Ready ─────────────────────────────
      // Only fires when the IC Memo was initiated from a Pitch Triage escalation.
      // Idempotency: stageAdvancedRef prevents duplicate calls if the user clicks
      // the IC Memo button again in the same session.
      if (!stageAdvancedRef.current && !isHistoryView) {
        const rawId = sessionStorage.getItem("pitchTriageEscalationId");
        if (rawId) {
          const triageId = parseInt(rawId, 10);
          if (!isNaN(triageId)) {
            stageAdvancedRef.current = true;
            sessionStorage.removeItem("pitchTriageEscalationId");
            updateTriageStage.mutate(
              { id: triageId, stage: "ic_ready" },
              { onSuccess: () => setMovedToIcReady(true) }
            );
          }
        }
      }
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

  // ── Section 17 text builder ─────────────────────────────────────────────────
  const buildSection17Text = (simData: typeof effectiveSimData): string => {
    if (!simData?.aggregation?.decisionDistribution) return "";
    const agg = simData.aggregation;
    const dist = agg.decisionDistribution;
    const na = "Not available";
    const lines: string[] = [];
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("17. SCENARIO STRESS SUMMARY");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push(`Simulation Mode:     ${simData.mode ?? na}`);
    lines.push(`Scenario Count:      ${(simData.targetCount ?? dist.totalScenarios ?? 0).toLocaleString()}`);
    lines.push(`Run Timestamp:       ${simData.completedAt ? new Date(simData.completedAt).toLocaleString() : na}`);
    lines.push("");
    lines.push("DECISION DISTRIBUTION");
    lines.push(`  Approve:           ${dist.approvePct?.toFixed(1) ?? na}% (${dist.approveCount ?? na} scenarios)`);
    lines.push(`  Conditional:       ${dist.conditionalPct?.toFixed(1) ?? na}% (${dist.conditionalCount ?? na} scenarios)`);
    lines.push(`  Reject:            ${dist.rejectPct?.toFixed(1) ?? na}% (${dist.rejectCount ?? na} scenarios)`);
    if (dist.hardNoPct != null) {
      lines.push(`  Hard-No Triggered: ${dist.hardNoPct.toFixed(1)}% (${dist.hardNoCount ?? 0} scenarios)`);
    }
    lines.push("");
    lines.push("EXECUTIVE SUMMARY");
    lines.push(agg.executiveSummary ?? na);
    lines.push("");
    // Top 3 failure vectors
    const fv: any[] = agg.failureVectors ?? [];
    lines.push("TOP FAILURE VECTORS");
    if (fv.length === 0) {
      lines.push(`  ${na}`);
    } else {
      fv.slice(0, 3).forEach((v: any, i: number) => {
        lines.push(`  ${i + 1}. ${v.category ?? na} — ${v.description ?? na} (${v.frequency != null ? (v.frequency * 100).toFixed(0) + "% of scenarios" : na})`);
      });
    }
    lines.push("");
    // Top 3 approval pathways
    const ap: any[] = agg.approvalPathways ?? [];
    lines.push("TOP APPROVAL PATHWAYS");
    if (ap.length === 0) {
      lines.push(`  ${na}`);
    } else {
      ap.slice(0, 3).forEach((p: any, i: number) => {
        lines.push(`  ${i + 1}. ${p.description ?? na} (${p.frequency != null ? (p.frequency * 100).toFixed(0) + "% of scenarios" : na})`);
      });
    }
    lines.push("");
    // Governance escalation highlights
    const gh: any[] = agg.governanceHeatmap ?? [];
    const escalations = gh.filter((g: any) => g.escalationRate > 0.1).slice(0, 3);
    lines.push("GOVERNANCE ESCALATION HIGHLIGHTS");
    if (escalations.length === 0) {
      lines.push(`  No significant escalation triggers detected.`);
    } else {
      escalations.forEach((g: any) => {
        lines.push(`  ${g.category ?? na}: ${g.escalationRate != null ? (g.escalationRate * 100).toFixed(0) + "% escalation rate" : na}`);
      });
    }
    lines.push("");
    // Sensitivity summary
    const ss: any[] = agg.sensitivitySurface ?? [];
    lines.push("SENSITIVITY SUMMARY");
    if (ss.length === 0) {
      lines.push(`  ${na}`);
    } else {
      ss.slice(0, 3).forEach((s: any, i: number) => {
        lines.push(`  ${i + 1}. ${s.dimension ?? na}: approval impact ${s.approvalImpact != null ? (s.approvalImpact > 0 ? "+" : "") + (s.approvalImpact * 100).toFixed(1) + "pp" : na}`);
      });
    }
    lines.push("");
    return lines.join("\n");
  };

  const handleCopyICReport = (text: string) => {
    // Append Section 17 if simulation data exists and not already present
    const section17 = buildSection17Text(effectiveSimData);
    const alreadyHasSection17 = text.includes("17. SCENARIO STRESS SUMMARY");
    const enrichedText = section17 && !alreadyHasSection17 ? text + section17 : text;
    navigator.clipboard.writeText(enrichedText).catch(() => {});
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
      {/* Duplicate banner */}
      {result.duplicate && (
        <div style={{ padding: "10px 16px", background: "rgba(74,158,255,0.10)", border: "1px solid rgba(74,158,255,0.5)", borderRadius: 6, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: ACCENT, fontWeight: 700 }}>DUPLICATE DETECTED — Returning cached result (0 LLM calls used)</span>
        </div>
      )}
      {/* Triage early-exit banner */}
      {result.triage && result.triage.decision !== "PROCEED" && (
        <div style={{ padding: "10px 16px", background: "rgba(255,159,67,0.10)", border: "1px solid rgba(255,159,67,0.5)", borderRadius: 6, marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 16, marginTop: 1 }}>⚠️</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: AMBER, fontWeight: 700 }}>TRIAGE FILTER — {result.triage.decision.replace(/_/g, " ")} ({(result.triage.confidence * 100).toFixed(0)}% confidence, {result.triage.durationMs}ms)</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{result.triage.reason}</span>
          </div>
        </div>
      )}
      {/* INSUFFICIENT_DATA banner — shown when ARE gates the deal */}
      {result.verdict === "INSUFFICIENT_DATA" && (
        <div style={{
          padding: "14px 18px",
          background: "rgba(255,159,67,0.10)",
          border: "1px solid rgba(255,159,67,0.6)",
          borderRadius: 8,
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}>
          <span style={{ fontSize: 18, marginTop: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, color: AMBER, fontWeight: 700, marginBottom: 4, letterSpacing: "0.06em" }}>
              INSUFFICIENT DATA — COUNCIL VERDICT WITHHELD
            </div>
            <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6 }}>
              {result.realityAlignment?.gateReason ?? "The Reality Alignment Engine detected critical data gaps. The council cannot issue a reliable verdict without the missing information."}
            </div>
            {result.realityAlignment && result.realityAlignment.missingFields.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.06em", alignSelf: "center" }}>MISSING:</span>
                {result.realityAlignment.missingFields.map((f, i) => (
                  <span key={i} style={{
                    fontFamily: MONO, fontSize: 10,
                    background: "rgba(255,159,67,0.12)",
                    border: "1px solid rgba(255,159,67,0.35)",
                    color: AMBER,
                    padding: "2px 8px", borderRadius: 3,
                  }}>{f}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ARE Data Quality badge — shown when realityAlignment is present */}
      {result.realityAlignment && result.verdict !== "INSUFFICIENT_DATA" && (
        <div style={{
          padding: "10px 16px",
          background: result.realityAlignment.dataConfidence === "HIGH"
            ? "rgba(0,255,135,0.07)" : result.realityAlignment.dataConfidence === "MEDIUM"
            ? "rgba(74,158,255,0.07)" : "rgba(255,159,67,0.07)",
          border: `1px solid ${
            result.realityAlignment.dataConfidence === "HIGH" ? "rgba(0,255,135,0.35)"
            : result.realityAlignment.dataConfidence === "MEDIUM" ? "rgba(74,158,255,0.35)"
            : "rgba(255,159,67,0.35)"
          }`,
          borderRadius: 6,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap" as const,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>DATA QUALITY</span>
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700,
            color: result.realityAlignment.dataConfidence === "HIGH" ? GREEN
              : result.realityAlignment.dataConfidence === "MEDIUM" ? ACCENT : AMBER,
            letterSpacing: "0.08em",
          }}>{result.realityAlignment.dataConfidence}</span>
          {result.realityAlignment.missingFields.length > 0 && (
            <span
              title={`Missing: ${result.realityAlignment.missingFields.join(", ")}`}
              style={{ fontFamily: MONO, fontSize: 10, color: MUTED, cursor: "help" }}
            >· {result.realityAlignment.missingFields.length} field{result.realityAlignment.missingFields.length !== 1 ? "s" : ""} missing</span>
          )}
          {result.realityAlignment.conflictScore > 0.3 && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: AMBER }}>· ⚡ Agent conflict detected</span>
          )}
        </div>
      )}

      {/* Decision Integrity — collapsed by default */}
      {result.decisionIntegrity && (
        <DecisionIntegritySection di={result.decisionIntegrity} />
      )}

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

      {/* Tab switcher — sticky */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0, position: "sticky", top: 0, zIndex: 10, background: "rgba(7,11,18,0.95)", backdropFilter: "blur(12px)", paddingTop: 8, marginTop: -4 }}>
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
          {movedToIcReady && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(0,255,135,0.07)", border: "1px solid rgba(0,255,135,0.25)",
              borderRadius: 4, padding: "4px 10px",
              fontFamily: MONO, fontSize: 9, color: GREEN, letterSpacing: "0.06em",
            }}>
              ✓ MOVED TO IC READY
            </div>
          )}
          {isHistoryView && onRerun && (
            <button
              onClick={() => { setRerunText(""); setRerunError(null); setRerunMode(result.councilMode ?? councilModeProp ?? "global_vc"); setRerunOpen(true); }}
              style={{ padding: "5px 14px", background: "rgba(168,85,247,0.15)", border: `1px solid ${PURPLE}`, color: PURPLE, fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em" }}
              title="Re-run this deal through the council — creates a new run, original is preserved"
            >↺ RE-RUN</button>
          )}
          <button
            onClick={onNewDeal}
            style={{ padding: "5px 14px", background: ACCENT, border: "none", color: "#000", fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em" }}
          >NEW DEAL</button>
        </div>
      </div>
      {/* ── Re-run modal ─────────────────────────────────────────────────── */}
      {rerunOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(7,11,18,0.85)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: "32px 36px", maxWidth: 560, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: PURPLE, letterSpacing: "0.15em", marginBottom: 4 }}>↺ RE-RUN · NEW INDEPENDENT SCREENING</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{result.dealName}</div>
              </div>
              <button
                onClick={() => setRerunOpen(false)}
                style={{ background: "none", border: "none", color: MUTED, fontSize: 18, cursor: "pointer", padding: "4px 8px" }}
              >✕</button>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 16, lineHeight: 1.6, padding: "10px 14px", background: "rgba(168,85,247,0.06)", border: `1px solid ${PURPLE}30`, borderRadius: 6 }}>
              {result.dealTextPreview
                ? <>ℹ️ A <strong style={{ color: PURPLE }}>preview snippet</strong> (first 200 chars) has been pre-filled from the original submission. Extend or replace it with the full deal memo for a complete re-run. This creates a <strong style={{ color: TEXT }}>new run</strong> — the original screening is preserved in history.
                  <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(168,85,247,0.08)", border: `1px solid ${PURPLE}40`, borderRadius: 4, fontSize: 9, color: MUTED, letterSpacing: "0.04em", lineHeight: 1.7 }}>
                    PREVIEW: <span style={{ color: TEXT2 }}>{result.dealTextPreview}</span>{result.dealTextPreview.length >= 200 ? <span style={{ color: AMBER }}>… (truncated)</span> : null}
                  </div>
                </>
                : <>ℹ️ Deal text is not stored for security. Paste the original deal memo below to re-run. This creates a <strong style={{ color: TEXT }}>new run</strong> — the original screening is preserved in history.</>
              }
            </div>
            {/* Council mode selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em", marginBottom: 8 }}>COUNCIL MODE</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["gcc", "global_vc", "india_pe", "infrastructure"] as CouncilModeType[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRerunMode(m)}
                    style={{
                      padding: "5px 12px", borderRadius: 4, fontFamily: MONO, fontSize: 9,
                      cursor: "pointer", letterSpacing: "0.08em",
                      background: rerunMode === m ? `${PURPLE}20` : "transparent",
                      border: `1px solid ${rerunMode === m ? PURPLE : BORDER}`,
                      color: rerunMode === m ? PURPLE : TEXT2,
                    }}
                  >{m === "gcc" ? "GCC" : m === "global_vc" ? "GLOBAL VC" : m === "india_pe" ? "INDIA PE" : "INFRASTRUCTURE"}</button>
                ))}
              </div>
            </div>
            {/* Deal text input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em", marginBottom: 8 }}>DEAL TEXT <span style={{ color: RED }}>*</span></div>
              <textarea
                value={rerunText}
                onChange={(e) => { setRerunText(e.target.value); setRerunError(null); }}
                placeholder={`Paste the original deal memo for "${result.dealName}" here…`}
                rows={8}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: BG, border: `1px solid ${rerunError ? RED : BORDER}`, borderRadius: 6,
                  color: TEXT, fontFamily: MONO, fontSize: 11, padding: "12px 14px",
                  resize: "vertical", outline: "none", lineHeight: 1.6,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = PURPLE; }}
                onBlur={e => { e.currentTarget.style.borderColor = rerunError ? RED : BORDER; }}
              />
              {rerunError && <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginTop: 4 }}>{rerunError}</div>}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setRerunOpen(false)}
                style={{ padding: "8px 18px", background: "none", border: `1px solid ${BORDER}`, color: TEXT2, fontFamily: MONO, fontSize: 10, cursor: "pointer", borderRadius: 4 }}
              >CANCEL</button>
              <button
                onClick={() => {
                  if (!rerunText.trim() || rerunText.trim().length < 10) {
                    setRerunError("Deal text must be at least 10 characters");
                    return;
                  }
                  setRerunOpen(false);
                  onRerun!(result.dealName, rerunText.trim(), rerunMode);
                }}
                style={{ padding: "8px 18px", background: PURPLE, border: "none", color: "#fff", fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em" }}
              >↺ LAUNCH RE-RUN →</button>
            </div>
          </div>
        </div>
      )}

      {/* Boardroom IC Report tab */}
      {activeTab === "boardroom" && result.icReport && (
        <BoardroomICReport ic={result.icReport} result={result} onCopy={handleCopyICReport} onNewDeal={onNewDeal} patternContext={patternContext} stressTested={simBadgeData?.hasCompleted} councilMode={result.councilMode ?? councilModeProp} onRerun={onRerun} />
      )}

      {/* Raw Council tab */}
      {activeTab === "raw" && (
        <div>
      {/* ── IC SUMMARY STRIP ──────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${BG2} 0%, rgba(13,20,33,0.95) 100%)`,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "24px 28px",
        marginBottom: 20,
        position: "relative" as const,
        overflow: "hidden" as const,
      }}>
        {/* Verdict accent line */}
        <div style={{
          position: "absolute" as const, top: 0, left: 0, right: 0, height: 3,
          background: result.verdict === "APPROVED" ? `linear-gradient(90deg, ${GREEN}, transparent)`
            : result.verdict === "APPROVED_WITH_CONDITIONS" ? `linear-gradient(90deg, ${ACCENT}, transparent)`
            : result.verdict === "VETOED" ? `linear-gradient(90deg, ${RED}, transparent)`
            : result.verdict === "REJECTED" ? `linear-gradient(90deg, ${RED}99, transparent)`
            : `linear-gradient(90deg, ${AMBER}, transparent)`,
          borderRadius: "10px 10px 0 0",
        }} />
        {/* Header: deal name + verdict badge */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.15em", marginBottom: 6 }}>
              {(result.councilMode === "infrastructure") ? "INFRASTRUCTURE & PROJECT FINANCE COUNCIL" :
               (result.councilMode === "global_vc") ? "GLOBAL VC COUNCIL · COUNCIL OF 10" :
               (result.councilMode === "india_pe") ? "INDIA PE / VC COUNCIL · COUNCIL OF 10" :
               (result.councilMode === "gcc_equities") ? "GCC EQUITIES COUNCIL · COUNCIL OF 10" :
               "INVESTMENT COMMITTEE · COUNCIL OF 10"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 22, color: TEXT, fontWeight: 700 }}>{result.dealName}</h2>
              {result.investorMode && (
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                  padding: "3px 8px", borderRadius: 3,
                  background: "rgba(0,255,135,0.10)", color: GREEN,
                  border: "1px solid rgba(0,255,135,0.3)",
                }}>INVESTOR MODE</span>
              )}
            </div>
          </div>
          <VerdictBadge verdict={result.verdict} />
        </div>

        {/* Confidence pill + vote breakdown */}
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: confidencePct >= 70 ? "rgba(0,255,135,0.08)" : confidencePct >= 50 ? "rgba(74,158,255,0.08)" : "rgba(255,159,67,0.08)",
            border: `1px solid ${confidencePct >= 70 ? "rgba(0,255,135,0.3)" : confidencePct >= 50 ? "rgba(74,158,255,0.3)" : "rgba(255,159,67,0.3)"}`,
            borderRadius: 6, padding: "8px 16px",
          }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>CONFIDENCE</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: confidencePct >= 70 ? GREEN : confidencePct >= 50 ? ACCENT : AMBER, lineHeight: 1 }}>{confidencePct}%</div>
          </div>
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

        {/* Council vote distribution bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN }}>YES {result.yesCount}/10</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>Council Vote Distribution</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: RED }}>NO {result.noCount}/10</span>
          </div>
          <div style={{ height: 6, background: BG3, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${yesPct}%`,
              background: `linear-gradient(90deg, ${GREEN}, ${ACCENT})`,
              borderRadius: 4,
              transition: "width 0.8s ease",
            }} />
          </div>
        </div>
      </div>

      {/* ── KEY DECISION DRIVERS ─────────────────────────────────────────── */}
      {result.votes.length > 0 && (() => {
        const yesFlags = result.votes
          .filter(v => v.vote === "HARD_YES" || v.vote === "SOFT_YES")
          .flatMap(v => (v.keyFlags ?? []).map(f => ({ flag: f, type: "FOR" as const })));
        const noFlags = result.votes
          .filter(v => v.vote === "HARD_NO" || v.vote === "SOFT_NO")
          .flatMap(v => (v.keyFlags ?? []).map(f => ({ flag: f, type: "AGAINST" as const })));
        const topFor = yesFlags.slice(0, 3);
        const topAgainst = noFlags.slice(0, 3);
        if (topFor.length === 0 && topAgainst.length === 0) return null;
        return (
          <div style={{
            background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8,
            padding: "16px 20px", marginBottom: 20,
            borderLeft: `3px solid ${ACCENT}`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, letterSpacing: "0.15em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚡</span> KEY DECISION DRIVERS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {topFor.length > 0 && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: GREEN, marginBottom: 8, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>✓</span> FOR THE DEAL
                  </div>
                  {topFor.map((item, i) => (
                    <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${GREEN}`, lineHeight: 1.5 }}>+ {item.flag}</div>
                  ))}
                </div>
              )}
              {topAgainst.length > 0 && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: RED, marginBottom: 8, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>✗</span> AGAINST THE DEAL
                  </div>
                  {topAgainst.map((item, i) => (
                    <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${RED}`, lineHeight: 1.5 }}>− {item.flag}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Persona vote cards */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.15em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><span>🗳️</span> COUNCIL VOTES — click to expand</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {result.votes.map((v) => (
            <VoteCard key={v.personaId} vote={v} result={result} />
          ))}
        </div>
      </div>

      {/* Conditions + Blockers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* ── Conditions to proceed ── */}
        <div style={{
          background: BG2,
          border: `1px solid rgba(255,159,67,0.3)`,
          borderRadius: 8,
          padding: "16px 20px",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: AMBER, letterSpacing: "0.15em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>📋</span> CONDITIONS TO PROCEED
            <span style={{ marginLeft: "auto", background: "rgba(255,159,67,0.15)", border: "1px solid rgba(255,159,67,0.3)", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{result.conditionsToProceed.length}</span>
          </div>
          {result.conditionsToProceed.length === 0 ? (
            <div style={{ fontSize: 12, color: MUTED }}>No conditions required</div>
          ) : (
            result.conditionsToProceed.map((c, i) => (
              <div key={i} style={{
                fontSize: 12, color: TEXT2, marginBottom: 6,
                padding: "6px 12px", background: "rgba(255,159,67,0.04)",
                borderLeft: `2px solid ${AMBER}`, borderRadius: "0 4px 4px 0", lineHeight: 1.5,
              }}>
                {c}
              </div>
            ))
          )}
        </div>

        {/* ── Blocking issues ── */}
        <div style={{
          background: BG2,
          border: `1px solid rgba(255,71,87,0.3)`,
          borderRadius: 8,
          padding: "16px 20px",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: RED, letterSpacing: "0.15em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🚫</span> BLOCKING ISSUES
            <span style={{ marginLeft: "auto", background: "rgba(255,71,87,0.15)", border: "1px solid rgba(255,71,87,0.3)", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{result.blockingIssues.length}</span>
          </div>
          {result.blockingIssues.length === 0 ? (
            <div style={{ fontSize: 12, color: MUTED }}>No blocking issues identified</div>
          ) : (
            result.blockingIssues.map((b, i) => (
              <div key={i} style={{
                fontSize: 12, color: TEXT2, marginBottom: 6,
                padding: "6px 12px", background: "rgba(255,71,87,0.04)",
                borderLeft: `2px solid ${RED}`, borderRadius: "0 4px 4px 0", lineHeight: 1.5,
              }}>
                {b}
              </div>
            ))
          )}
        </div>
       </div>

      {/* ── Quantitative Evidence (GCC Equities only) ─────────────────────── */}
      {result.councilMode === "gcc_equities" && result.evidenceBlob && (
        <QuantitativeEvidenceSection evidenceBlob={result.evidenceBlob} />
      )}

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

      {/* ── Section 10: Decision Upgrade Protocol ─────────────────────────── */}
      <DecisionUpgradePanel
        domain="deal"
        originalRunId={result.dealId ?? result.dealName}
        originalInput={result.dealText ?? result.dealTextPreview ?? ""}
        verdictBefore={result.verdict}
        confidenceBefore={result.confidenceScore}
        blockingIssues={result.blockingIssues ?? []}
        conditions={result.conditionsToProceed ?? []}
        agentFeedback={result.votes?.map(v => `${v.personaName}: ${v.rationale}`).join("\n") ?? ""}
        dealMeta={{ dealName: result.dealName ?? "Deal" }}
        onProtocolReady={setLiftedProtocol}
        onDeltaReady={setLiftedDelta}
      />
      {/* ── Section 11: Strategic Scenario Simulation Dashboard ─────────── */}
      <div style={{ marginTop: 8, borderTop: "1px solid #1e2d3d", paddingTop: 24 }}>
        <ScenarioSimDashboard
          dealId={result.dealId ?? result.dealName}
          dealName={result.dealName}
          dealText={result.dealText ?? result.dealTextPreview ?? ""}
          onSimCompleted={handleSimCompleted}
          councilMode={councilModeProp ?? result.councilMode as CouncilModeType | undefined}
        />
      </div>
      {/* ── Section 12: Institutional Reports Export Hub ──────────────── */}
      <div style={{ marginTop: 8, paddingBottom: 32 }}>
        <ReportsPanel
          dealName={result.dealName}
          dealId={result.dealId}
          verdict={result.verdict}
          confidenceScore={result.confidenceScore}
          onExportICMemo={handleICMemoPdf}
          icMemoLoading={icMemoLoading}
          upgradeProtocol={liftedProtocol}
          upgradeDelta={liftedDelta}
          simRunId={effectiveSimData?.runId ?? null}
          simMode={effectiveSimData?.mode ?? undefined}
          simTargetCount={effectiveSimData?.targetCount ?? undefined}
          simCompletedAt={effectiveSimData?.completedAt ?? undefined}
          simAggregation={effectiveSimData?.aggregation ?? null}
        />
      </div>
    </div>
  );
}

// ──// ── Deal Form ─────────────────────────────────────────────────────
const OWNER_EMAILS_LIST = ["farouq@agenthink.ai", "farouqsultan@gmail.com"];
function DealForm({ onResult, onSubmitStart, onError: onSubmitError, pendingPaymentSessionId, onPaymentVerified, councilMode, setCouncilMode, onChangeWorkflow }: {
  onResult: (r: CouncilResult) => void;
  onSubmitStart: () => void;
  onError: (msg: string) => void;
  pendingPaymentSessionId: string | null;
  onPaymentVerified: () => void;
  councilMode: CouncilModeType;
  setCouncilMode: (m: CouncilModeType) => void;
  onChangeWorkflow?: () => void;
}) {
  const { user: authUser } = useAuth();
  const [dealName, setDealName] = useState("");
  const [dealText, setDealText] = useState("");
  const [sourceType, setSourceType] = useState<"manual" | "signal">("manual");
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
  const [investorMode, setInvestorMode] = useState(false);
  // Strategic Scenario Simulation
  const [simEnabled, setSimEnabled] = useState(false);
  const [simMode, setSimMode] = useState<"quick" | "institutional" | "deep" | "infrastructure" | "extreme">("quick");
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

  // Pre-fill from Pitch Triage escalation
  // Primary source: wouter router state (set by navigate("/deals", { state: { pitchTriageText, pitchTriageId } }))
  // Fallback source: sessionStorage (set by handleEscalate as belt-and-suspenders)
  useEffect(() => {
    // Primary: router state (reliable, no race conditions)
    const histState = window.history.state as { pitchTriageText?: string; pitchTriageId?: number } | null;
    if (histState?.pitchTriageText) {
      setDealText(histState.pitchTriageText);
      setGuidedMode(false);
      // Capture triage ID for stage auto-advance after IC Memo generation
      if (histState.pitchTriageId) {
        sessionStorage.setItem("pitchTriageEscalationId", String(histState.pitchTriageId));
      }
      // Clear text from history state to prevent re-fill on back/forward navigation
      // Keep pitchTriageId in sessionStorage (cleared after IC Memo generation)
      const { pitchTriageText: _removed, pitchTriageId: _removedId, ...rest } = histState;
      window.history.replaceState(rest, "");
      return;
    }
    // Fallback: sessionStorage
    const triageText = sessionStorage.getItem("pitchTriageEscalation");
    if (triageText) {
      setDealText(triageText);
      setGuidedMode(false);
      sessionStorage.removeItem("pitchTriageEscalation");
      // pitchTriageEscalationId stays in sessionStorage until IC Memo is generated
    }
  }, []);

  // Listen for Tier 0 signal pre-fill events from the Signals feed
  useEffect(() => {
    const handler = (e: Event) => {
      const { dealName: name, dealText: text, sourceType: src } = (e as CustomEvent).detail;
      if (name) setDealName(name);
      if (text) setDealText(text);
      if (src) setSourceType(src as "manual" | "signal");
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
      screenMutation.mutate({ dealName: dealName.trim(), dealText: finalText, councilMode, sourceType, investorMode });
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
    screenMutation.mutate({ dealName: result.dealName, dealText: result.dealText, councilMode, investorMode });
  };

  // If data room mode is active, render the upload/review component
  if (dataRoomMode) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em", marginBottom: 8 }}>
            DECISION ENGINE · COUNCIL OF 10
          </div>
          <h1 style={{ margin: 0, fontSize: 28, color: TEXT, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Decision Council
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
          DECISION ENGINE · COUNCIL OF 10
        </div>
        <h1 style={{ margin: 0, fontSize: 28, color: TEXT, fontWeight: 800, letterSpacing: "-0.02em" }}>
          Decision Council
        </h1>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 10, padding: "3px 12px", borderRadius: 3, background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.3)", color: GREEN, letterSpacing: "0.08em" }}>📊 INVESTMENT WORKFLOW</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>·</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.06em" }}>EXAMPLE USE CASE</span>
          {onChangeWorkflow && (
            <button
              onClick={onChangeWorkflow}
              style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, letterSpacing: "0.06em" }}
            >← CHANGE WORKFLOW</button>
          )}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
          Run structured, multi-agent evaluations across any workflow.<br />
          Investment · Procurement · Compliance · Healthcare · Custom
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([
              { key: "gcc" as const, icon: "🏗️", label: "GCC Institutional", desc: "Kuwait CMA · Shariah · Vision 2035" },
              { key: "global_vc" as const, icon: "🌐", label: "Global VC", desc: "Sequoia · a16z · Lightspeed lens" },
              { key: "india_pe" as const, icon: "🇮🇳", label: "India PE / VC", desc: "SEBI · FEMA · NSE/BSE exits" },
              { key: "infrastructure" as const, icon: "⚡", label: "Infrastructure / Project Finance", desc: "DSCR · CfD · EPC · Offtake · IRR" },
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

        {/* Mode safety warning — shown when infrastructure keywords detected in non-infrastructure mode */}
        {councilMode !== "infrastructure" && (() => {
          const infraKeywords = ["dscr", "cfd", "lcoe", "epc", "offtake", "ppa", "offshore wind", "floating wind", "project finance", "capex", "debt service", "lender", "mw ", "gwh", "turbine", "substation", "grid connection", "infrastructure fund", "construction risk", "commissioning"];
          const textLower = (dealText + " " + dealName).toLowerCase();
          const hasInfraSignals = infraKeywords.filter(kw => textLower.includes(kw)).length >= 2;
          if (!hasInfraSignals) return null;
          return (
            <div style={{
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(255,159,67,0.08)",
              border: "1px solid rgba(255,159,67,0.4)",
              borderRadius: 6,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#ff9f43", letterSpacing: "0.06em", marginBottom: 4 }}>INFRASTRUCTURE DEAL DETECTED</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,159,67,0.8)", lineHeight: 1.5 }}>
                  This deal memo contains infrastructure signals (DSCR, CfD, EPC, LCOE, MW, etc.).
                  The current <strong style={{ color: "#ff9f43" }}>{councilMode === "global_vc" ? "Global VC" : councilMode === "india_pe" ? "India PE" : "GCC Institutional"}</strong> council
                  uses VC/PE rubrics that are not calibrated for project finance.
                  {" "}<button
                    type="button"
                    onClick={() => setCouncilMode("infrastructure")}
                    style={{ background: "none", border: "none", color: "#ff9f43", fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  >Switch to Infrastructure / Project Finance mode</button>
                  {" "}for DSCR, CfD, EPC, and IRR-calibrated analysis.
                </div>
              </div>
            </div>
          );
        })()}

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

        {/* Helios-North Demo Fixture — auto-selects Infrastructure mode */}
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => {
              const HELIOS_MEMO = `PROJECT: Helios-North Offshore Wind
LOCATION: Celtic Sea (South-West UK, floating-wind zone, water depth 70–95m)
CAPACITY: 850 MW
TOTAL CAPEX: £5.88bn
BASE CASE IRR: 9.5%
FUND MINIMUM IRR: 15%

IC DECISION: REJECT (0/10 COUNCIL · 92% CONSENSUS · 10/10 HARD NO)

PRIMARY BLOCKERS:
1. Foundation Technology: Unvalidated floating foundation at commercial scale — no independent engineering validation
2. CfD Strike Price: £73/MWh is below fund IRR threshold; AR7 outcome uncertain
3. Merchant Exposure: 20% unhedged merchant exposure creates material downside risk
4. Contingency: 1.7% contingency is dangerously low for first-of-kind technology
5. EPC: No committed EPC contractor with fixed-price contract
6. Timeline: 11-year project timeline exceeds fund horizon (7 years)

CONDITIONS FOR RE-ENGAGEMENT:
- Foundation technology independently validated at commercial scale
- CfD strike price ≥ £85/MWh (AR7 mid-range)
- Merchant exposure reduced to ≤ 10%
- Committed EPC with fixed-price contract
- Contingency increased to ≥ 5%`;
              setDealName("Helios-North Offshore Wind");
              setDealText(HELIOS_MEMO);
              setGuidedMode(false); // switch to expert mode
              setCouncilMode("infrastructure"); // auto-select Infrastructure mode
            }}
            style={{
              padding: "8px 16px",
              background: "rgba(255,159,67,0.06)",
              border: "1px solid rgba(255,159,67,0.4)",
              borderRadius: 4,
              color: "#ff9f43",
              fontFamily: MONO,
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.06em",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,159,67,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,159,67,0.06)"; }}
          >
            ⚡ LOAD HELIOS-NORTH DEMO
            <span style={{ fontFamily: MONO, fontSize: 9, color: "rgba(255,159,67,0.6)", background: "rgba(255,159,67,0.1)", border: "1px solid rgba(255,159,67,0.25)", borderRadius: 2, padding: "1px 5px" }}>INFRA MODE</span>
          </button>
          <span style={{ marginLeft: 10, fontSize: 10, color: MUTED, fontFamily: MONO }}>Celtic Sea · 850 MW floating wind · £5.88bn CAPEX · 0/10 council</span>
        </div>

        {/* Investor Mode toggle */}
        <div
          onClick={() => setInvestorMode(v => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: investorMode ? "rgba(0,255,135,0.07)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${investorMode ? "rgba(0,255,135,0.35)" : BORDER}`,
            borderRadius: 6,
            cursor: "pointer",
            marginBottom: 16,
            transition: "all 0.15s",
          }}
        >
          {/* Toggle pill */}
          <div style={{
            width: 36, height: 20,
            background: investorMode ? GREEN : "rgba(255,255,255,0.1)",
            borderRadius: 10,
            position: "relative",
            transition: "background 0.2s",
            flexShrink: 0,
          }}>
            <div style={{
              position: "absolute",
              top: 3, left: investorMode ? 18 : 3,
              width: 14, height: 14,
              background: investorMode ? "#000" : "#888",
              borderRadius: "50%",
              transition: "left 0.2s",
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: investorMode ? GREEN : TEXT2, fontWeight: 700, letterSpacing: "0.06em" }}>
              INVESTOR MODE
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 2 }}>
              Reframes agents to upside-first: “what would make this a winning investment?”
            </div>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 10, color: investorMode ? GREEN : MUTED }}>
            {investorMode ? "ON" : "OFF"}
          </span>
        </div>

        {/* Strategic Scenario Simulation Toggle */}
        <div style={{ marginBottom: 16 }}>
          <ScenarioSimToggle
            enabled={simEnabled}
            onChange={setSimEnabled}
            selectedMode={simMode}
            onModeChange={setSimMode}
          />
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
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.04em" }}>Not sure yet? </span>
          <a
            href="/pitch-triage"
            style={{
              fontFamily: MONO, fontSize: 10, color: "#a78bfa",
              textDecoration: "none", letterSpacing: "0.04em",
              borderBottom: "1px solid rgba(167,139,250,0.4)",
              paddingBottom: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#c4b5fd")}
            onMouseLeave={e => (e.currentTarget.style.color = "#a78bfa")}
          >
            ⚡ Fast Triage first →
          </a>
        </div>

        <div style={{ textAlign: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
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
type HistoryFilter = "ALL" | "APPROVED" | "CONDITIONAL" | "REJECTED" | "FROM_SIGNAL";

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
        councilMode:         (deal as { councilMode?: "gcc" | "global_vc" | "india_pe" | "gcc_equities" | "infrastructure" }).councilMode,
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
    { label: "From Signal", value: "FROM_SIGNAL", color: "#a855f7" },
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
    if (filter === "FROM_SIGNAL") return row.sourceType === "signal";
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{row.dealName}</span>
              {row.sourceType === "signal" && (
                <span style={{
                  fontFamily: MONO,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: "rgba(168,85,247,0.12)",
                  color: "#a855f7",
                  border: "1px solid rgba(168,85,247,0.3)",
                  whiteSpace: "nowrap",
                }}>FROM SIGNAL</span>
              )}
              {row.investorMode && (
                <span style={{
                  fontFamily: MONO,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: "rgba(0,255,135,0.10)",
                  color: GREEN,
                  border: "1px solid rgba(0,255,135,0.3)",
                  whiteSpace: "nowrap",
                }}>INVESTOR MODE</span>
              )}
            </div>
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
type View = "workflow" | "input" | "loading" | "report" | "history" | "signals" | "batch";

type WorkflowType = "investment" | "procurement" | "compliance" | "healthcare" | "custom";

const WORKFLOW_OPTIONS: Array<{ id: WorkflowType; label: string; sublabel: string; icon: string; badge?: string }> = [
  { id: "investment", label: "Investment / Deal Screening", sublabel: "VC, PE, M&A, and growth equity evaluation", icon: "📊", badge: "EXAMPLE USE CASE" },
  { id: "procurement", label: "Procurement / Vendor Evaluation", sublabel: "Supplier selection, RFP scoring, contract risk", icon: "🏗️" },
  { id: "compliance", label: "Compliance / Risk Review", sublabel: "Regulatory, AML/KYC, policy adherence checks", icon: "⚖️" },
  { id: "healthcare", label: "Healthcare / Clinical Decision", sublabel: "Treatment protocols, diagnostic support, triage", icon: "🏥" },
  { id: "custom", label: "Custom Workflow", sublabel: "Define your own agent configuration and criteria", icon: "⚙️" },
];

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
  const [view, setView] = useState<View>("workflow");
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
  const [previousView, setPreviousView] = useState<View | null>(null);
  const { data: signalData } = trpc.dealScreener.listSignals.useQuery(
    undefined,
    { enabled: !isDemo }
  );
  const unreadSignalCount = signalData?.unreadCount ?? 0;
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  // ── 30-second minimum loading hold ──────────────────────────────────────────
  const loadingStartedAt = useRef<number | null>(null);
  const MIN_LOADING_MS = 30_000;
  const [screenError, setScreenError] = useState<string | null>(null);
  const [councilMode, setCouncilMode] = useState<CouncilModeType>("global_vc");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [escalationPatternContext, _setEscalationPatternContext] = useState<"invested_match" | "passed_match" | undefined>(() => {
    // Read patternContext set by PitchTriage handleEscalate — consumed once then cleared
    const stored = sessionStorage.getItem("pitchTriagePatternContext");
    if (stored === "invested_match" || stored === "passed_match") {
      sessionStorage.removeItem("pitchTriagePatternContext");
      return stored;
    }
    // Also check router history state (belt-and-suspenders)
    const histState = window.history.state as { patternContext?: string } | null;
    if (histState?.patternContext === "invested_match" || histState?.patternContext === "passed_match") {
      return histState.patternContext as "invested_match" | "passed_match";
    }
    return undefined;
  });

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

  // Navigate to report view — respects the 30-second minimum loading hold
  const navigateToReport = React.useCallback((r: CouncilResult) => {
    const elapsed = loadingStartedAt.current ? Date.now() - loadingStartedAt.current : MIN_LOADING_MS;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
    setResult(r);
    if (remaining <= 0) {
      setView("report");
    } else {
      setTimeout(() => setView("report"), remaining);
    }
  }, [MIN_LOADING_MS]);

  // Top-level screen mutation — used when Data Room tab uploads exactly 1 deal
  const topLevelScreenMutation = trpc.dealScreener.screen.useMutation({
    onSuccess: (data) => {
      navigateToReport(data as unknown as CouncilResult);
    },
    onError: (err) => {
      setScreenError(err.message);
      setView("input");
    },
  });

  const handleResult = (r: CouncilResult) => {
    navigateToReport(r);
  };

  const handleNewDeal = () => {
    setResult(null);
    setView("input");
  };

  const handleHistorySelect = (dealId: string) => {
    setSelectedDealId(dealId);
    setView("loading"); // show loading spinner while getById resolves
  };
  const handleRerun = (dealName: string, dealText: string, mode: CouncilModeType) => {
    // Navigate to input view and pre-fill the form with the original deal data
    setCouncilMode(mode);
    setPreviousView(null);
    setSelectedDealId(null);
    setResult(null);
    setView("input");
    // Fire the pre-fill event after a short delay so DealForm has mounted
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("tier0:prefill", {
        detail: { dealName, dealText, sourceType: "manual" },
      }));
    }, 80);
  };

  useEffect(() => {
    if (dealDetail) {
      // History navigation — no loading screen shown, navigate immediately
      setResult(dealDetail as unknown as CouncilResult);
      setPreviousView("history");
      setView("report");
    }
  }, [dealDetail]);

  // Track unauthenticated preview view (TASK 4)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      trackEvent("deal_screening_preview_view", { referrer: document.referrer });
    }
  }, [loading, isAuthenticated]);

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", position: "relative" }}>
        {/* Blurred sample output */}
        <div style={{ filter: "blur(6px)", opacity: 0.35, pointerEvents: "none", userSelect: "none", padding: "40px 24px 0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 24 }}>DEAL SCREENER — SAMPLE OUTPUT</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
              {[{label:"OVERALL SCORE",val:"72 / 100",color:"#4ade80"},{label:"CONVICTION",val:"ENGAGE",color:"#4ade80"},{label:"RISK LEVEL",val:"MEDIUM",color:"#fbbf24"}].map(m => (
                <div key={m.label} style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px" }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, letterSpacing: "0.1em", marginBottom: 8 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, letterSpacing: "0.1em", marginBottom: 12 }}>AGENT COUNCIL BREAKDOWN</div>
              {["Market Opportunity Agent","Competitive Moat Agent","Financial Viability Agent","Team Assessment Agent","Regulatory Risk Agent"].map((a, i) => (
                <div key={a} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, flex: 1 }}>{a}</div>
                  <div style={{ width: 120, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${[72,68,81,65,74][i]}%`, height: "100%", background: ACCENT, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, width: 30, textAlign: "right" }}>{[72,68,81,65,74][i]}</div>
                </div>
              ))}
            </div>
            <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 24px" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, letterSpacing: "0.1em", marginBottom: 12 }}>IC MEMO EXCERPT</div>
              <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.7 }}>
                The company operates in a $4.2B addressable market with a defensible SaaS moat. Revenue growth of 3.2× YoY with net dollar retention of 118% signals strong product-market fit. Key risks include regulatory exposure in 3 jurisdictions and a 14-month cash runway at current burn...
              </div>
            </div>
          </div>
        </div>

        {/* Overlay gate */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(to bottom, transparent 0%, rgba(7,11,18,0.85) 35%, rgba(7,11,18,0.97) 60%)",
        }}>
          <div style={{ textAlign: "center", maxWidth: 460, padding: "0 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚖️</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Deal Screener</div>
            <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.65, marginBottom: 28 }}>
              Run a full AI council evaluation on any deal — market, moat, financials, team, and regulatory risk — and get a scored IC Memo in under 60 seconds.
            </div>
            {/* Demo link — above sign-in CTA */}
            <div style={{ marginBottom: 16 }}>
              <a
                href={(() => {
                  try {
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const lang = navigator.language || "";
                    const isGcc = /Asia\/(Kuwait|Riyadh|Dubai|Bahrain|Muscat|Qatar|Aden)/.test(tz) || /^ar/.test(lang);
                    return isGcc ? "/gcc-ic" : "/sg-ic";
                  } catch { return "/sg-ic"; }
                })()}
                onClick={() => {
                  try {
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const lang = navigator.language || "";
                    const isGcc = /Asia\/(Kuwait|Riyadh|Dubai|Bahrain|Muscat|Qatar|Aden)/.test(tz) || /^ar/.test(lang);
                    const dest = isGcc ? "/gcc-ic" : "/sg-ic";
                    trackEvent("deal_screening_demo_click", { destination: dest, location: "deals_preview" });
                  } catch {}
                }}
                style={{
                  display: "inline-block", padding: "9px 20px",
                  background: "transparent", color: ACCENT,
                  border: `1px solid ${ACCENT}55`,
                  borderRadius: 6, fontFamily: MONO, fontSize: 11,
                  fontWeight: 600, textDecoration: "none",
                }}
              >
                See a full deal memo example →
              </a>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={getLoginUrl()} style={{
                display: "inline-block", padding: "12px 28px",
                background: ACCENT, color: "#000",
                borderRadius: 6, fontFamily: MONO, fontSize: 12,
                fontWeight: 700, textDecoration: "none",
              }}>SIGN IN TO RUN A SCREEN →</a>
              <a href="/pitchmirror" style={{
                display: "inline-block", padding: "12px 20px",
                background: "transparent", color: TEXT2,
                border: `1px solid ${BORDER}`,
                borderRadius: 6, fontFamily: MONO, fontSize: 12,
                fontWeight: 600, textDecoration: "none",
              }}>Try PitchMirror free →</a>
            </div>
            {/* Pricing link — below sign-in CTA */}
            <div style={{ marginTop: 14 }}>
              <a href="/pricing" style={{ fontFamily: MONO, fontSize: 10, color: MUTED, textDecoration: "none", borderBottom: `1px solid ${MUTED}55` }}>See pricing →</a>
            </div>
            <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 10, color: MUTED }}>115 agents · 14 domains · avg 47s per evaluation</div>
          </div>
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
      {/* Positioning statement banner */}
      <div data-print-hide style={{
        background: "rgba(74,158,255,0.06)",
        borderBottom: `1px solid rgba(74,158,255,0.18)`,
        padding: "8px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", fontWeight: 700 }}>AGENTHINK MESH</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>Not a model. A structured decision layer that orchestrates specialized AI agents.</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em" }}>Investment · Procurement · Compliance · Healthcare · Custom</span>
      </div>
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
            { id: "workflow" as View, label: "NEW DEAL" },
            { id: "history" as View, label: "HISTORY" },
            { id: "signals" as View, label: "SIGNALS 🎓" },
            { id: "batch" as View, label: "DATA ROOM" },
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
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {tab.label}
              {tab.id === "signals" && unreadSignalCount > 0 && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 14,
                  height: 14,
                  borderRadius: 7,
                  background: ACCENT,
                  color: "#000",
                  fontFamily: MONO,
                  fontSize: 8,
                  fontWeight: 700,
                  padding: "0 3px",
                  lineHeight: 1,
                }}>{unreadSignalCount}</span>
              )}
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
            href="/procurement"
            style={{ fontFamily: MONO, fontSize: 10, color: GREEN, textDecoration: "none", letterSpacing: "0.08em", padding: "5px 12px", border: "1px solid rgba(0,255,135,0.35)", borderRadius: 4, background: "rgba(0,255,135,0.07)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,135,0.14)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,135,0.07)"; }}
          >
            🏗️ PROCUREMENT ↗
          </a>
          <a
            href="/account/payments"
            style={{ fontFamily: MONO, fontSize: 10, color: MUTED, textDecoration: "none", letterSpacing: "0.08em" }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            BILLING ↗
          </a>
          <a
            href="/demos"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: MONO, fontSize: 10, color: MUTED, textDecoration: "none", letterSpacing: "0.08em" }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            LIVE EXAMPLES ↗
          </a>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
            DECISION ENGINE · COUNCIL OF 10
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "40px 24px", maxWidth: 960, margin: "0 auto" }}>
        {view === "workflow" && (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            {/* Platform positioning statement */}
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em", marginBottom: 12 }}>AGENTHINK MESH · DECISION ENGINE</div>
              <h1 style={{ margin: "0 0 12px", fontSize: 32, color: TEXT, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>Select Your Workflow</h1>
              <p style={{ margin: "0 auto", fontSize: 14, color: TEXT2, lineHeight: 1.7, maxWidth: 520 }}>
                AgenThink Mesh is not a model. It is a structured decision layer that orchestrates specialized AI agents across any institutional workflow.
              </p>
            </div>

            {/* Primary two-workflow grid — Investment and Procurement as equal-weight CTAs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
              {/* Investment Card */}
              <button
                onClick={() => { setSelectedWorkflow("investment"); setView("input"); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  padding: "32px 28px", background: "rgba(74,158,255,0.06)",
                  border: "1px solid rgba(74,158,255,0.35)", borderRadius: 12,
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "border-color 0.15s, background 0.15s, transform 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ACCENT; (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,158,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(74,158,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,158,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                <span style={{ fontSize: 36, lineHeight: 1, marginBottom: 16 }}>📊</span>
                <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Investment / Deal Screening</div>
                <div style={{ fontSize: 13, color: TEXT2, marginBottom: 20, lineHeight: 1.5 }}>VC, PE, M&A, and growth equity evaluation. Council of 10 specialist agents.</div>
                <span style={{ fontFamily: MONO, fontSize: 10, padding: "5px 14px", borderRadius: 4, background: "rgba(74,158,255,0.15)", border: "1px solid rgba(74,158,255,0.4)", color: ACCENT, letterSpacing: "0.08em" }}>RUN INVESTMENT SCREENING →</span>
              </button>

              {/* Procurement Card — equal weight, green accent */}
              <button
                onClick={() => { window.location.href = "/procurement"; }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  padding: "32px 28px", background: "rgba(0,255,135,0.05)",
                  border: "1px solid rgba(0,255,135,0.35)", borderRadius: 12,
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "border-color 0.15s, background 0.15s, transform 0.1s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = GREEN; (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,135,0.1)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,255,135,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,135,0.05)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 36, lineHeight: 1 }}>🏗️</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, padding: "2px 8px", borderRadius: 3, background: "rgba(0,255,135,0.15)", border: "1px solid rgba(0,255,135,0.4)", color: GREEN, letterSpacing: "0.08em" }}>LIVE</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Procurement / Vendor Evaluation</div>
                <div style={{ fontSize: 13, color: TEXT2, marginBottom: 20, lineHeight: 1.5 }}>Supplier selection, RFP scoring, contract risk. 9 agents including Devil's Advocate.</div>
                <span style={{ fontFamily: MONO, fontSize: 10, padding: "5px 14px", borderRadius: 4, background: "rgba(0,255,135,0.15)", border: "1px solid rgba(0,255,135,0.4)", color: GREEN, letterSpacing: "0.08em" }}>RUN PROCUREMENT EVALUATION →</span>
              </button>
            </div>

            {/* Secondary workflows — coming soon */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {WORKFLOW_OPTIONS.filter(wf => wf.id !== "investment" && wf.id !== "procurement").map((wf) => (
                <div
                  key={wf.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "16px 20px", background: BG2,
                    border: `1px solid ${BORDER}`, borderRadius: 8,
                    opacity: 0.6,
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{wf.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 3 }}>{wf.label}</div>
                    <span style={{ fontFamily: MONO, fontSize: 9, padding: "2px 7px", borderRadius: 3, background: "rgba(255,159,67,0.1)", border: "1px solid rgba(255,159,67,0.25)", color: AMBER, letterSpacing: "0.08em" }}>COMING SOON</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
                {view === "input" && (
          <>
            <DealForm
              onResult={handleResult}
              onSubmitStart={() => { setScreenError(null); loadingStartedAt.current = Date.now(); setView("loading"); }}
              onError={(msg) => { setScreenError(msg); setView("input"); }}
              pendingPaymentSessionId={pendingPaymentSessionId}
              onPaymentVerified={() => setPendingPaymentSessionId(null)}
              councilMode={councilMode}
              setCouncilMode={setCouncilMode}
              onChangeWorkflow={() => setView("workflow")}
            />
            <RecentSignalsPanel onScreen={(text) => {
              // Pre-fill deal text via the tier0:prefill event (mark as signal-sourced)
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("tier0:prefill", { detail: { dealName: "", dealText: text, sourceType: "signal" } }));
              }, 50);
            }} />
          </>
        )}
        {view === "input" && screenError && (
          <div style={{ maxWidth: 680, margin: "-16px auto 0", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontFamily: MONO, fontSize: 11, color: "#F87171" }}>
            {screenError}
          </div>
        )}
        {view === "loading" && <PersonaLoadingGrid councilMode={councilMode} loadingStartedAt={loadingStartedAt} />}
        {view === "report" && result && (
          <div>
            {previousView === "history" && (
              <div style={{ maxWidth: 900, margin: "0 auto 12px", padding: "0 16px" }}>
                <button
                  onClick={() => { setPreviousView(null); setSelectedDealId(null); setView("history"); }}
                  style={{
                    background: "none",
                    border: `1px solid ${BORDER}`,
                    color: TEXT2,
                    padding: "7px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: MONO,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ACCENT; (e.currentTarget as HTMLButtonElement).style.color = ACCENT; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; (e.currentTarget as HTMLButtonElement).style.color = TEXT2; }}
                >
                  ← Back to History
                </button>
              </div>
            )}
            {previousView === "batch" && (
              <div style={{ maxWidth: 900, margin: "0 auto 12px", padding: "0 16px" }}>
                <button
                  onClick={() => { setPreviousView(null); setView("batch"); }}
                  style={{
                    background: "none",
                    border: "1px solid #1e2d3d",
                    color: "#94a3b8",
                    padding: "7px 16px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#4a9eff"; (e.currentTarget as HTMLButtonElement).style.color = "#4a9eff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e2d3d"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
                >
                  ← Back to Deal Summary
                </button>
              </div>
            )}
            <ICReport key={result.dealId ?? result.dealName} result={result} onNewDeal={handleNewDeal} councilMode={councilMode} isHistoryView={previousView === "history"} onRerun={handleRerun} patternContext={escalationPatternContext} />
          </div>
        )}
        {view === "history" && (
          <HistoryTable onSelect={(id) => { handleHistorySelect(id); }} />
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
        {/* DataRoomV2 stays mounted while in batch or drilling down so results grid state is preserved */}
        {(view === "batch" || previousView === "batch") && (
          <div style={{ display: view === "batch" ? "block" : "none" }}>
            <DataRoomV2
              onDrillDown={(councilResult) => {
                setResult(councilResult as CouncilResult);
                setPreviousView("batch");
                setView("report");
              }}
              onCancel={() => { setPreviousView(null); setView("input"); }}
              onSingleDeal={(dealName, dealText, mode) => {
                // 1 file uploaded — hand off to single-deal council flow
                setCouncilMode(mode);
                setScreenError(null);
                setPreviousView(null);
                loadingStartedAt.current = Date.now();
                setView("loading");
                topLevelScreenMutation.mutate({ dealName, dealText, councilMode: mode });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
