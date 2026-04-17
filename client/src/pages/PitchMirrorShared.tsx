/**
 * PitchMirrorShared — Public read-only view of a shared PitchMirror result.
 * Route: /pitchmirror/r/:token
 *
 * Rules:
 *   - No login required
 *   - Read-only: no input, no rerun, no editing
 *   - No account info, no IDs, no internal metadata
 *   - Shows 3 sections + header + CTA to try PitchMirror
 *   - Shows "Evaluated at: [stage]" pill when founderStageLabel is present
 *   - Legacy shared links (no stage) render without error — pill is simply hidden
 */

import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Design tokens (matches PitchMirror dark theme) ────────────────────────────
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

type MirrorSections = {
  whatInvestorsSee: { strengths: string[]; concerns: string[] };
  whatToFix: string[];
  whatsMissing: string[];
};

export default function PitchMirrorShared() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, error } = trpc.pitch.getShare.useQuery(
    { shareToken: token },
    { enabled: token.length > 0, retry: false }
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: `3px solid ${ACCENT}`, borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ color: TEXT2, fontSize: 14 }}>Loading shared result…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: "0 0 10px" }}>Result not found</h2>
          <p style={{ fontSize: 14, color: TEXT2, margin: "0 0 28px", lineHeight: 1.6 }}>
            This shared result may have expired or the link may be incorrect.
          </p>
          <Link href="/pitchmirror">
            <button style={{
              background: `linear-gradient(135deg, ${ACCENT} 0%, #9333ea 100%)`,
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 14, fontWeight: 700, padding: "12px 28px", cursor: "pointer",
            }}>
              Try PitchMirror on your own pitch
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const sections = data.sections as MirrorSections;
  // founderStageLabel is null for legacy shares — pill is hidden gracefully
  const founderStageLabel: string | null = (data as { founderStageLabel?: string | null }).founderStageLabel ?? null;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: BG2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🪞</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>PitchMirror</span>
          <span style={{
            background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 6, color: "#c084fc", fontSize: 11, fontWeight: 700,
            padding: "2px 8px", letterSpacing: "0.05em",
          }}>SHARED RESULT</span>
        </div>
        <Link href="/pitchmirror">
          <button style={{
            background: `linear-gradient(135deg, ${ACCENT} 0%, #9333ea 100%)`,
            border: "none", borderRadius: 8, color: "#fff",
            fontSize: 12, fontWeight: 700, padding: "8px 18px", cursor: "pointer",
          }}>
            Try on your pitch →
          </button>
        </Link>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Title + stage pill */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: "0 0 8px" }}>
            Shared PitchMirror result
          </h1>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 12px" }}>
            Investor-style feedback generated by PitchMirror · Read-only view
          </p>

          {/* Evaluated-at pill — only shown when stage is present (new shares) */}
          {founderStageLabel && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: ACCENT_LIGHT,
                border: `1px solid rgba(124,58,237,0.3)`,
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 11,
                fontWeight: 600,
                color: "#c084fc",
                letterSpacing: 0.2,
              }}
            >
              <span style={{ opacity: 0.7 }}>Evaluated at:</span>
              <span>{founderStageLabel}</span>
            </div>
          )}
        </div>

        {/* ── Section 1: What Investors See ─────────────────────────────────── */}
        <Section
          icon="👁"
          title="What Investors See"
          subtitle="How this pitch reads from an investor's perspective"
        >
          {sections.whatInvestorsSee.strengths.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: "0.08em", margin: "0 0 10px", textTransform: "uppercase" }}>
                Strengths
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sections.whatInvestorsSee.strengths.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: GREEN, flexShrink: 0, marginTop: 1,
                    }}>✓</span>
                    <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sections.whatInvestorsSee.concerns.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: AMBER, letterSpacing: "0.08em", margin: "0 0 10px", textTransform: "uppercase" }}>
                Concerns
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sections.whatInvestorsSee.concerns.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: AMBER, flexShrink: 0, marginTop: 1,
                    }}>!</span>
                    <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── Section 2: What to Fix ────────────────────────────────────────── */}
        <Section
          icon="🔧"
          title="What to Fix Before Sending"
          subtitle="Specific improvements to make before sharing with investors"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sections.whatToFix.map((fix, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#c084fc", flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>{fix}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 3: What's Missing ─────────────────────────────────────── */}
        {sections.whatsMissing.length > 0 && (
          <Section
            icon="🔍"
            title="What's Missing"
            subtitle="Critical gaps that investors will notice"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sections.whatsMissing.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: RED, flexShrink: 0, marginTop: 1,
                  }}>○</span>
                  <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Copy button ───────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <SharedCopyButton sections={sections} founderStageLabel={founderStageLabel} />
        </div>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <div style={{
          marginTop: 16,
          background: `linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(192,132,252,0.06) 100%)`,
          border: `1px solid rgba(124,58,237,0.2)`,
          borderRadius: 14,
          padding: "28px 28px 24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🪞</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: TEXT, margin: "0 0 8px" }}>
            Try PitchMirror on your own pitch
          </h3>
          <p style={{ fontSize: 13, color: TEXT2, margin: "0 0 20px", lineHeight: 1.6 }}>
            Get investor-style feedback on your pitch in under 10 seconds.
            No sign-in required for your first run.
          </p>
          <Link href="/pitchmirror">
            <button style={{
              background: `linear-gradient(135deg, ${ACCENT} 0%, #9333ea 100%)`,
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 14, fontWeight: 700, padding: "13px 32px", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(124,58,237,0.3)",
            }}>
              Analyze my pitch →
            </button>
          </Link>
          <p style={{ fontSize: 11, color: MUTED, margin: "12px 0 0" }}>No credit card required.</p>
        </div>
      </div>
    </div>
  );
}

// ── SharedCopyButton ──────────────────────────────────────────────────────────
function SharedCopyButton({
  sections,
  founderStageLabel,
}: {
  sections: MirrorSections;
  founderStageLabel: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function buildText() {
    const lines: string[] = ["PITCHMIRROR FEEDBACK\n"];
    if (founderStageLabel) {
      lines.push(`Stage: ${founderStageLabel}\n`);
    }
    lines.push("WHAT INVESTORS SEE");
    lines.push("Strengths:");
    sections.whatInvestorsSee.strengths.forEach((x) => lines.push(`  ✓ ${x}`));
    lines.push("Concerns:");
    sections.whatInvestorsSee.concerns.forEach((x) => lines.push(`  ! ${x}`));
    lines.push("\nWHAT TO FIX BEFORE SENDING");
    sections.whatToFix.forEach((x, i) => lines.push(`  ${i + 1}. ${x}`));
    lines.push("\nWHAT'S MISSING");
    sections.whatsMissing.forEach((x) => lines.push(`  ○ ${x}`));
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

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  icon, title, subtitle, children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: BG2,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      padding: "24px 24px 20px",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: TEXT, margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 18px", paddingLeft: 28 }}>{subtitle}</p>
      <div style={{ paddingLeft: 0 }}>{children}</div>
    </div>
  );
}
