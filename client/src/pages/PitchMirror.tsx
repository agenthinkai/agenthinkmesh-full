/**
 * PitchMirror — Founder-facing pitch feedback interface.
 * Reuses the existing evaluation pipeline via pitch.mirror mutation.
 * Output: 3 plain-language sections (What Investors See, What to Fix, What's Missing).
 *
 * Auth flow:
 *   - Unauthenticated: 1 free guest run (sessionStorage gate), no DB write
 *   - Authenticated: existing behavior (pitchMirrorRuns counter, gated flag)
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

const GUEST_RUN_KEY = "pitchMirrorGuestRun";

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

type ViewState = "INPUT" | "LOADING" | "RESULTS" | "GUEST_BLOCKED";

export default function PitchMirror() {
  const { user } = useAuth();
  const [pitchText, setPitchText] = useState("");
  const [view, setView] = useState<ViewState>("INPUT");
  const [result, setResult] = useState<MirrorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mirrorMutation = trpc.pitch.mirror.useMutation({
    onSuccess: (data) => {
      // Mark guest run consumed
      if (!user) {
        sessionStorage.setItem(GUEST_RUN_KEY, "true");
      }
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

    // Guest gate: block second run
    if (!user && sessionStorage.getItem(GUEST_RUN_KEY) === "true") {
      setView("GUEST_BLOCKED");
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
  const isGuest = !user;

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

        {/* ── GUEST BLOCKED state ────────────────────────────────────────────── */}
        {view === "GUEST_BLOCKED" && (
          <div
            style={{
              marginTop: 32,
              background: BG2,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: "32px 28px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
              You've used your free guest analysis
            </p>
            <p style={{ fontSize: 13, color: TEXT2, marginBottom: 24, maxWidth: 380, margin: "0 auto 24px" }}>
              Create a free account to run another evaluation and save your results.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href={getLoginUrl()}
                style={{
                  display: "inline-block",
                  background: ACCENT,
                  color: "#fff",
                  borderRadius: 8,
                  padding: "11px 28px",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Create free account
              </a>
              <a
                href={getLoginUrl()}
                style={{
                  display: "inline-block",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${BORDER}`,
                  color: TEXT2,
                  borderRadius: 8,
                  padding: "11px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign in
              </a>
            </div>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 16 }}>No credit card required.</p>
          </div>
        )}

        {/* ── INPUT state ────────────────────────────────────────────────────── */}
        {view === "INPUT" && (
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
              {isGuest
                ? "Free guest analysis — no account required. Create a free account to save results and run more."
                : "Free tier: 2 analyses included. No credit card required."}
            </div>
          </div>
        )}

        {/* ── LOADING state ──────────────────────────────────────────────────── */}
        {view === "LOADING" && (
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
        {view === "RESULTS" && result && (
          <div style={{ marginTop: 32 }}>
            {/* Usage gate banner (authenticated users who've hit limit) */}
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
              {!isGuest && <ShareButton sections={result.sections} />}
            </div>

            {/* ── Post-result sign-in card (guest only, non-blocking) ─────────── */}
            {isGuest && (
              <div
                style={{
                  marginTop: 32,
                  background: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(192,132,252,0.06) 100%)",
                  border: `1px solid rgba(124,58,237,0.25)`,
                  borderRadius: 14,
                  padding: "28px 28px 24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: ACCENT_LIGHT,
                      border: `1px solid rgba(124,58,237,0.3)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    🪞
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: TEXT, margin: "0 0 6px" }}>
                      Save your results and run again
                    </h3>
                    <p style={{ fontSize: 13, color: TEXT2, margin: "0 0 20px", lineHeight: 1.6 }}>
                      Create a free account to save this evaluation and run more pitches.
                    </p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <a
                        href={getLoginUrl()}
                        style={{
                          display: "inline-block",
                          background: ACCENT,
                          color: "#fff",
                          borderRadius: 8,
                          padding: "10px 24px",
                          fontSize: 13,
                          fontWeight: 700,
                          textDecoration: "none",
                          transition: "opacity 0.15s",
                        }}
                      >
                        Create free account
                      </a>
                      <a
                        href={getLoginUrl()}
                        style={{
                          display: "inline-block",
                          background: "rgba(255,255,255,0.06)",
                          border: `1px solid ${BORDER}`,
                          color: TEXT2,
                          borderRadius: 8,
                          padding: "10px 20px",
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Sign in
                      </a>
                      <span style={{ fontSize: 11, color: MUTED }}>No credit card required.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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

function ShareButton({ sections }: { sections: MirrorResult["sections"] }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const createShare = trpc.pitch.createShare.useMutation();

  async function handleShare() {
    if (state === "loading") return;
    setState("loading");
    try {
      const { shareToken } = await createShare.mutateAsync({ sections });
      const url = `${window.location.origin}/pitchmirror/r/${shareToken}`;
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  const label = state === "loading" ? "Generating…" : state === "copied" ? "✓ Link copied!" : state === "error" ? "Failed — retry" : "Copy share link";
  const bg = state === "copied" ? "rgba(34,197,94,0.12)" : state === "error" ? "rgba(248,113,113,0.12)" : "rgba(124,58,237,0.12)";
  const border = state === "copied" ? "rgba(34,197,94,0.3)" : state === "error" ? "rgba(248,113,113,0.3)" : "rgba(124,58,237,0.3)";
  const color = state === "copied" ? GREEN : state === "error" ? RED : "#c084fc";

  return (
    <button
      onClick={handleShare}
      disabled={state === "loading"}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        color,
        fontSize: 13,
        fontWeight: 600,
        padding: "10px 20px",
        cursor: state === "loading" ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        opacity: state === "loading" ? 0.7 : 1,
      }}
    >
      🔗 {label}
    </button>
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
