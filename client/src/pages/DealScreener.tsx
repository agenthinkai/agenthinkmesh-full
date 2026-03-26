/**
 * DealScreener.tsx
 * Bloomberg Terminal-style dark UI for the Council of 10 Deal Screener.
 * Three views: INPUT → LOADING → REPORT (with HISTORY tab)
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { isDemoMode, DEMO_DEAL_SCREENER_DATA } from "@/lib/demo";

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
}

// ── Persona metadata ──────────────────────────────────────────────────────────
const PERSONA_META: Record<string, { icon: string; color: string }> = {
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

// ── Verdict badge ─────────────────────────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: VerdictType }) {
  const config = {
    APPROVED: { label: "APPROVED", bg: "rgba(0,255,135,0.12)", border: "#00ff87", color: "#00ff87", glow: "0 0 20px rgba(0,255,135,0.3)" },
    APPROVED_WITH_CONDITIONS: { label: "APPROVED WITH CONDITIONS", bg: "rgba(74,158,255,0.12)", border: "#4a9eff", color: "#4a9eff", glow: "0 0 20px rgba(74,158,255,0.3)" },
    REJECTED: { label: "REJECTED", bg: "rgba(255,71,87,0.12)", border: "#ff4757", color: "#ff4757", glow: "0 0 20px rgba(255,71,87,0.3)" },
    VETOED: { label: "VETOED", bg: "rgba(255,71,87,0.18)", border: "#ff4757", color: "#ff4757", glow: "0 0 30px rgba(255,71,87,0.5)" },
  }[verdict];
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 20px",
      borderRadius: 4,
      background: config.bg,
      border: `1px solid ${config.border}`,
      boxShadow: config.glow,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: config.color, letterSpacing: "0.1em" }}>
        {config.label}
      </span>
    </div>
  );
}

// ── VoteCard ──────────────────────────────────────────────────────────────────
function VoteCard({ vote }: { vote: PersonaVote }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PERSONA_META[vote.personaId] ?? { icon: "🤖", color: ACCENT };
  const isYes = vote.vote === "HARD_YES" || vote.vote === "SOFT_YES";

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
const PERSONA_ORDER = [
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
];

function PersonaLoadingGrid() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev < PERSONA_ORDER.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: ACCENT, letterSpacing: "0.1em", marginBottom: 8 }}>
          CONVENING THE INVESTMENT COUNCIL
        </div>
        <div style={{ fontSize: 12, color: TEXT2 }}>10 specialist AI advisors are reviewing your deal memo</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {PERSONA_ORDER.map((p, i) => {
          const meta = PERSONA_META[p.id] ?? { icon: "🤖", color: ACCENT };
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

// ── IC Report ─────────────────────────────────────────────────────────────────
function ICReport({ result, onNewDeal }: { result: CouncilResult; onNewDeal: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            GCC VETO TRIGGERED — Regulatory or Shariah hard block detected
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
            <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginBottom: 4 }}>IC REPORT</div>
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
            <VoteCard key={v.personaId} vote={v} />
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

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          onClick={handleCopyJson}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            color: TEXT2,
            fontFamily: MONO,
            fontSize: 11,
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          {copied ? "✓ COPIED" : "COPY IC REPORT JSON"}
        </button>
        <button
          onClick={onNewDeal}
          style={{
            padding: "8px 20px",
            background: ACCENT,
            border: "none",
            borderRadius: 4,
            color: "#000",
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          NEW DEAL
        </button>
      </div>
    </div>
  );
}

// ── Deal Form ─────────────────────────────────────────────────────────────────
function DealForm({ onResult, onSubmitStart, onError: onSubmitError }: {
  onResult: (r: CouncilResult) => void;
  onSubmitStart: () => void;
  onError: (msg: string) => void;
}) {
  const [dealName, setDealName] = useState("");
  const [dealText, setDealText] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: rateData } = trpc.dealScreener.rateLimit.useQuery();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Colour-code the badge: green >50%, amber <50%, red <3 remaining
  const getBadgeColor = () => {
    if (!rateData || rateData.limit === -1) return "#00c4a0"; // enterprise = teal
    const pct = rateData.remaining / rateData.limit;
    if (rateData.remaining < 3) return "#ff5a5a";
    if (pct < 0.5) return "#f59e0b";
    return "#00c4a0";
  };

  const screenMutation = trpc.dealScreener.screen.useMutation({
    onSuccess: (data) => {
      onResult(data as CouncilResult);
    },
    onError: (err) => {
      // Check if this is a rate limit error
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.code === "RATE_LIMIT_EXCEEDED") {
          setShowUpgradeModal(true);
          onSubmitError("Daily limit reached");
          return;
        }
      } catch { /* not JSON, treat as regular error */ }
      setError(err.message);
      onSubmitError(err.message);
    },
  });

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

  const handleSubmit = () => {
    if (!dealName.trim()) { setError("Deal name is required"); return; }
    if (!dealText.trim()) { setError("Deal description is required"); return; }
    setError(null);
    onSubmitStart();
    screenMutation.mutate({ dealName: dealName.trim(), dealText: dealText.trim() });
  };

  const charCount = dealText.length;
  const isLoading = screenMutation.isPending;

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
        {rateData && (
          <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 4,
              border: `1px solid ${getBadgeColor()}33`,
              background: `${getBadgeColor()}11`,
              fontFamily: MONO,
              fontSize: 10,
              color: getBadgeColor(),
              letterSpacing: "0.08em",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: getBadgeColor(), display: "inline-block" }} />
              {rateData.limit === -1
                ? "UNLIMITED · ENTERPRISE"
                : `${rateData.remaining} / ${rateData.limit} SCREENS REMAINING TODAY · ${rateData.plan.toUpperCase()}`
              }
            </div>
          </div>
        )}

        {/* Upgrade modal */}
        {showUpgradeModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }} onClick={() => setShowUpgradeModal(false)}>
            <div style={{
              background: BG2, border: `1px solid #ff5a5a55`,
              borderRadius: 8, padding: "32px 36px", maxWidth: 420, width: "90%",
              textAlign: "center",
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🚫</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: "#ff5a5a", letterSpacing: "0.12em", marginBottom: 8 }}>DAILY LIMIT REACHED</div>
              <h3 style={{ color: TEXT, fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>Daily limit reached</h3>
              <p style={{ color: TEXT2, fontSize: 13, lineHeight: 1.6, margin: "0 0 8px" }}>
                You've used all your screens for today. Upgrade to{" "}
                <strong style={{ color: ACCENT }}>Pro</strong> for 50 screens/day or{" "}
                <strong style={{ color: ACCENT }}>Enterprise</strong> for unlimited access.
              </p>
              <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED, margin: "0 0 24px", letterSpacing: "0.04em" }}>
                Your limit resets at midnight UTC
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <a
                  href="mailto:farouq@agenthinkmesh.com?subject=Upgrade%20Deal%20Screener%20Plan"
                  style={{
                    padding: "10px 20px", background: ACCENT, color: BG,
                    borderRadius: 4, fontFamily: MONO, fontSize: 11,
                    fontWeight: 600, textDecoration: "none", letterSpacing: "0.06em",
                  }}
                >
                  Contact us to upgrade
                </a>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  style={{
                    padding: "10px 20px", background: "transparent",
                    border: `1px solid ${BORDER}`, color: TEXT2,
                    borderRadius: 4, fontFamily: MONO, fontSize: 11,
                    cursor: "pointer", letterSpacing: "0.06em",
                  }}
                >
                  OK, got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form card */}
      <div style={{
        background: BG2,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "28px 32px",
      }}>
        {/* Deal name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
            DEAL NAME *
          </label>
          <input
            value={dealName}
            onChange={(e) => setDealName(e.target.value)}
            placeholder="e.g. Tamara Series B — BNPL GCC"
            maxLength={255}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: BG3,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              color: TEXT,
              fontFamily: MONO,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Deal text */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em" }}>
              DEAL MEMO / DESCRIPTION *
            </label>
            <span style={{ fontFamily: MONO, fontSize: 10, color: charCount > 2800 ? AMBER : MUTED }}>
              {charCount}/3000
            </span>
          </div>
          <textarea
            value={dealText}
            onChange={(e) => setDealText(e.target.value)}
            placeholder="Paste the deal memo, pitch deck summary, or description here. Include: business model, market size, team, traction, financials, and ask."
            maxLength={3000}
            rows={10}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: BG3,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              color: TEXT,
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

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

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !dealName.trim() || !dealText.trim()}
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
          {isLoading ? "CONVENING COUNCIL..." : "SCREEN THIS DEAL →"}
        </button>
      </div>
    </div>
  );
}

// ── History Table ─────────────────────────────────────────────────────────────
function HistoryTable({ onSelect }: { onSelect: (dealId: string) => void }) {
  const { data: history, isLoading } = trpc.dealScreener.history.useQuery();

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

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginBottom: 16 }}>
        DEAL HISTORY — {history.length} screenings
      </div>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr 80px 80px 100px 120px",
          padding: "10px 16px",
          background: BG3,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          {["DEAL NAME", "VERDICT", "YES", "NO", "CONFIDENCE", "DATE"].map((h) => (
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
              gridTemplateColumns: "2fr 1.2fr 80px 80px 100px 120px",
              padding: "12px 16px",
              borderBottom: `1px solid ${BORDER}`,
              cursor: "pointer",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BG2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{row.dealName}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: verdictColor[row.verdict] ?? TEXT2 }}>
              {row.verdict.replace(/_/g, " ")}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: GREEN }}>{row.yesCount}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: RED }}>{row.noCount}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT2 }}>
              {Math.round(parseFloat(row.confidenceScore as unknown as string) * 100)}%
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
              {new Date(row.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main DealScreener page ────────────────────────────────────────────────────
type View = "input" | "loading" | "report" | "history";

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
  const { isAuthenticated, loading } = useAuth();
  const [view, setView] = useState<View>("input");
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);

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
      {/* Top nav */}
      <div style={{
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
        <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, color: MUTED }}>
          DEAL SCREENER · COUNCIL OF 10
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "40px 24px", maxWidth: 960, margin: "0 auto" }}>
        {view === "input" && (
          <DealForm
            onResult={handleResult}
            onSubmitStart={() => { setScreenError(null); setView("loading"); }}
            onError={(msg) => { setScreenError(msg); setView("input"); }}
          />
        )}
        {view === "input" && screenError && (
          <div style={{ maxWidth: 680, margin: "-16px auto 0", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontFamily: MONO, fontSize: 11, color: "#F87171" }}>
            {screenError}
          </div>
        )}
        {view === "loading" && <PersonaLoadingGrid />}
        {view === "report" && result && (
          <ICReport result={result} onNewDeal={handleNewDeal} />
        )}
        {view === "history" && (
          <HistoryTable onSelect={(id) => { setSelectedDealId(id); }} />
        )}
      </div>
    </div>
  );
}
