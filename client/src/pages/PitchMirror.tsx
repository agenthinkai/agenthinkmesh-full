/**
 * PitchMirror — Founder-facing pitch feedback interface.
 * Reuses the existing evaluation pipeline via pitch.mirror mutation.
 * Output: 3 plain-language sections (What Investors See, What to Fix, What's Missing).
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Design tokens (dark, consistent with rest of app) ─────────────────────────
const BG = "#0d0d14";
const BG2 = "#13131f";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#e2e8f0";
const TEXT2 = "#94a3b8";
const MUTED = "#64748b";
const ACCENT = "#7c3aed";
const ACCENT_LIGHT = "rgba(124,58,237,0.15)";
const GREEN = "#4ade80";
const AMBER = "#fbbf24";
const RED = "#f87171";

type MirrorResult = {
  gated: boolean;
  runsUsed: number;
  freeRunsAllowed: number;
  sections: {
    whatInvestorsSee: { strengths: string[]; concerns: string[] };
    whatToFix: string[];
    whatsMissing: string[];
  };
};

type ViewState = "INPUT" | "LOADING" | "RESULTS";

export default function PitchMirror() {
  const { user } = useAuth();
  const [pitchText, setPitchText] = useState("");
  const [view, setView] = useState<ViewState>("INPUT");
  const [result, setResult] = useState<MirrorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mirrorMutation = trpc.pitch.mirror.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setView("RESULTS");
    },
    onError: (err) => {
      setError(err.message || "Something went wrong. Please try again.");
      setView("INPUT");
    },
  });

  function handleAnalyze() {
    if (!pitchText.trim() || pitchText.trim().length < 30) {
      setError("Please paste a pitch of at least 30 characters.");
      return;
    }
    setError(null);
    setView("LOADING");
    mirrorMutation.mutate({ pitchText: pitchText.trim() });
  }

  function handleReset() {
    setView("INPUT");
    setResult(null);
    setError(null);
  }

  const wordCount = pitchText.trim().split(/\s+/).filter(Boolean).length;
  const charCount = pitchText.length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "0 0 80px",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: `1px solid ${BORDER}`,
          padding: "28px 24px 24px",
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: ACCENT_LIGHT,
              border: `1px solid rgba(124,58,237,0.3)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🪞
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
              PitchMirror
            </h1>
            <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
              Investor-style feedback before you send
            </p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: TEXT2, margin: 0, lineHeight: 1.6, maxWidth: 560 }}>
          Paste your pitch below. PitchMirror runs it through the same evaluation framework used by
          institutional investors and returns plain-language guidance — no scores, no verdicts.
        </p>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
        {/* ── Not logged in ──────────────────────────────────────────────────── */}
        {!user && (
          <div
            style={{
              marginTop: 32,
              background: BG2,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: "28px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 15, color: TEXT2, marginBottom: 16 }}>
              Sign in to analyze your pitch.
            </p>
            <a
              href={getLoginUrl()}
              style={{
                display: "inline-block",
                background: ACCENT,
                color: "#fff",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Sign In
            </a>
          </div>
        )}

        {/* ── INPUT state ────────────────────────────────────────────────────── */}
        {user && view === "INPUT" && (
          <div style={{ marginTop: 32 }}>
            {error && (
              <div
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: `1px solid rgba(239,68,68,0.3)`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: RED,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <textarea
              value={pitchText}
              onChange={(e) => setPitchText(e.target.value)}
              placeholder={`Paste your pitch here — e.g.:\n\n"We are building a B2B SaaS platform for SMEs in the GCC to automate accounts payable. The market is $1.2B and growing at 18% annually. We have 3 paying customers generating $8K MRR. The founding team has 12 years of combined fintech experience..."`}
              style={{
                width: "100%",
                minHeight: 240,
                background: BG2,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                color: TEXT,
                fontSize: 14,
                lineHeight: 1.7,
                padding: "16px 18px",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <span style={{ fontSize: 11, color: MUTED }}>
                {wordCount} words · {charCount}/3000 chars
              </span>
              <button
                onClick={handleAnalyze}
                disabled={pitchText.trim().length < 30}
                style={{
                  background: pitchText.trim().length >= 30 ? ACCENT : "rgba(124,58,237,0.3)",
                  color: pitchText.trim().length >= 30 ? "#fff" : "rgba(255,255,255,0.4)",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 28px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: pitchText.trim().length >= 30 ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                  letterSpacing: 0.2,
                }}
              >
                Analyze My Pitch →
              </button>
            </div>

            {/* Usage indicator */}
            <div
              style={{
                marginTop: 20,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                fontSize: 11,
                color: MUTED,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: GREEN }}>●</span>
              Free tier: 2 analyses included. No credit card required.
            </div>
          </div>
        )}

        {/* ── LOADING state ──────────────────────────────────────────────────── */}
        {user && view === "LOADING" && (
          <div
            style={{
              marginTop: 48,
              textAlign: "center",
              padding: "48px 24px",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: `3px solid ${ACCENT_LIGHT}`,
                borderTopColor: ACCENT,
                animation: "spin 0.9s linear infinite",
                margin: "0 auto 24px",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: 15, fontWeight: 600, color: TEXT2, marginBottom: 8 }}>
              Analyzing your pitch…
            </p>
            <p style={{ fontSize: 12, color: MUTED }}>
              Running 6 evaluation agents in parallel. Usually under 10 seconds.
            </p>
            <div style={{ marginTop: 28, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {["Market Signal", "Business Model", "Traction", "Founder Signal", "Risk", "Completeness"].map((name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 10,
                    color: MUTED,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 20,
                    padding: "3px 10px",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
          </div>
        )}

        {/* ── RESULTS state ──────────────────────────────────────────────────── */}
        {user && view === "RESULTS" && result && (
          <div style={{ marginTop: 32 }}>
            {/* Usage gate banner */}
            {result.gated && (
              <div
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: `1px solid rgba(245,158,11,0.3)`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: AMBER, margin: "0 0 4px" }}>
                    Free analyses used ({result.freeRunsAllowed}/{result.freeRunsAllowed})
                  </p>
                  <p style={{ fontSize: 12, color: TEXT2, margin: 0 }}>
                    You've used your {result.freeRunsAllowed} free PitchMirror analyses. This result
                    is still shown. Upgrade to continue analyzing pitches.
                  </p>
                </div>
              </div>
            )}

            {/* Section 1: What Investors See */}
            <SectionCard
              emoji="👁"
              title="What Investors See"
              subtitle="How your pitch reads from the investor's perspective"
            >
              {result.sections.whatInvestorsSee.strengths.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 0.8, margin: "0 0 8px", textTransform: "uppercase" }}>
                    Strengths
                  </p>
                  {result.sections.whatInvestorsSee.strengths.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                      <span style={{ color: GREEN, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <p style={{ fontSize: 13, color: TEXT, margin: 0, lineHeight: 1.6 }}>{s}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.sections.whatInvestorsSee.concerns.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: 0.8, margin: "0 0 8px", textTransform: "uppercase" }}>
                    Concerns
                  </p>
                  {result.sections.whatInvestorsSee.concerns.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                      <span style={{ color: AMBER, fontSize: 14, flexShrink: 0, marginTop: 1 }}>!</span>
                      <p style={{ fontSize: 13, color: TEXT, margin: 0, lineHeight: 1.6 }}>{c}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Section 2: What to Fix Before Sending */}
            <SectionCard
              emoji="🔧"
              title="What to Fix Before Sending"
              subtitle="Specific, actionable improvements mapped to detected weaknesses"
            >
              {result.sections.whatToFix.map((fix, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: ACCENT_LIGHT,
                      border: `1px solid rgba(124,58,237,0.3)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#a78bfa",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </div>
                  <p style={{ fontSize: 13, color: TEXT, margin: 0, lineHeight: 1.65 }}>{fix}</p>
                </div>
              ))}
            </SectionCard>

            {/* Section 3: What's Missing */}
            <SectionCard
              emoji="📋"
              title="What's Missing"
              subtitle="Critical gaps that investors will notice"
            >
              {result.sections.whatsMissing.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <span style={{ color: RED, fontSize: 13, flexShrink: 0, marginTop: 2 }}>○</span>
                  <p style={{ fontSize: 13, color: TEXT2, margin: 0, lineHeight: 1.6 }}>{item}</p>
                </div>
              ))}
            </SectionCard>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleReset}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  color: TEXT2,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 20px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                ← Analyze Another Pitch
              </button>
              <CopyButton result={result} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  emoji,
  title,
  subtitle,
  children,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: BG2,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: "20px 22px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: TEXT }}>{title}</h2>
      </div>
      <p style={{ fontSize: 11, color: MUTED, margin: "0 0 16px", paddingLeft: 28 }}>{subtitle}</p>
      <div style={{ paddingLeft: 0 }}>{children}</div>
    </div>
  );
}

function CopyButton({ result }: { result: MirrorResult }) {
  const [copied, setCopied] = useState(false);

  function buildText() {
    const s = result.sections;
    const lines: string[] = ["PITCHMIRROR FEEDBACK\n"];
    lines.push("WHAT INVESTORS SEE");
    lines.push("Strengths:");
    s.whatInvestorsSee.strengths.forEach((x) => lines.push(`  ✓ ${x}`));
    lines.push("Concerns:");
    s.whatInvestorsSee.concerns.forEach((x) => lines.push(`  ! ${x}`));
    lines.push("\nWHAT TO FIX BEFORE SENDING");
    s.whatToFix.forEach((x, i) => lines.push(`  ${i + 1}. ${x}`));
    lines.push("\nWHAT'S MISSING");
    s.whatsMissing.forEach((x) => lines.push(`  ○ ${x}`));
    return lines.join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : BORDER}`,
        borderRadius: 8,
        color: copied ? GREEN : TEXT2,
        fontSize: 13,
        fontWeight: 600,
        padding: "10px 20px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ Copied!" : "Copy Feedback"}
    </button>
  );
}
