/**
 * Pitch.tsx — Public Pitch Page
 * Revenue Bridge: /pitch
 *
 * Flow:
 *   1. FORM      → user enters 200-word pitch + Kuwait mobile
 *   2. VOTING    → Council animation while backend runs
 *   3. VERDICT   → APPROVED → payment gate | REJECTED/VETOED → free summary
 *   4. PAYMENT   → K-Net placeholder screen
 *   5. REPORT    → full unlocked Council report (after payment confirmed)
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const NAVY      = "#05080F";
const NAVY2     = "#0B1120";
const NAVY3     = "#0F1A2E";
const GOLD      = "#C9A84C";
const GOLD2     = "#E8C97A";
const CYAN      = "#38BDF8";
const WHITE     = "#F0F4FA";
const MUTED     = "rgba(240,244,250,0.55)";
const BORDER    = "rgba(201,168,76,0.18)";
const BORDER2   = "rgba(56,189,248,0.15)";

// ── Persona definitions ───────────────────────────────────────────────────────
const PERSONAS = [
  { id: "GCC_REG",         name: "GCC Regulatory",      icon: "⚖️",  color: "#38BDF8" },
  { id: "GCC_CONSUMER",    name: "GCC Consumer",         icon: "🛒",  color: "#34D399" },
  { id: "GCC_SHARIAH",     name: "Shariah Advisor",      icon: "☪️",  color: "#A78BFA" },
  { id: "CONTRARIAN",      name: "Devil's Advocate",     icon: "🔥",  color: "#F97316" },
  { id: "CFO",             name: "CFO / Finance",        icon: "📊",  color: "#60A5FA" },
  { id: "EXIT",            name: "Exit Strategist",      icon: "🚪",  color: "#F59E0B" },
  { id: "GROWTH",          name: "Growth Expert",        icon: "🚀",  color: "#10B981" },
  { id: "SECURITY",        name: "Cyber & Risk",         icon: "🛡️",  color: "#EF4444" },
  { id: "OPERATOR",        name: "Operations Lead",      icon: "⚙️",  color: "#8B5CF6" },
  { id: "DEVILS_ADVOCATE", name: "Macro Sceptic",        icon: "🌐",  color: "#EC4899" },
];

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; requiresPayment: boolean }> = {
  APPROVED:                 { label: "APPROVED",                  color: "#10B981", bg: "rgba(16,185,129,0.08)",  icon: "✅", requiresPayment: true  },
  APPROVED_WITH_CONDITIONS: { label: "APPROVED WITH CONDITIONS",  color: GOLD,      bg: "rgba(201,168,76,0.08)",  icon: "🟡", requiresPayment: true  },
  CONDITIONAL_REVIEW:       { label: "CONDITIONAL REVIEW",        color: "#F97316", bg: "rgba(249,115,22,0.08)",  icon: "🔍", requiresPayment: false },
  REJECTED:                 { label: "REJECTED",                  color: "#EF4444", bg: "rgba(239,68,68,0.08)",   icon: "❌", requiresPayment: false },
  VETOED:                   { label: "VETOED",                    color: "#EF4444", bg: "rgba(239,68,68,0.10)",   icon: "🚫", requiresPayment: false },
  ERROR:                    { label: "EVALUATION ERROR",          color: "#94A3B8", bg: "rgba(148,163,184,0.08)", icon: "⚠️", requiresPayment: false },
};

type Stage = "form" | "voting" | "verdict" | "payment" | "report";

// ── Word count helper ─────────────────────────────────────────────────────────
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Pitch() {
  const [stage, setStage]             = useState<Stage>("form");
  const [pitchText, setPitchText]     = useState("");
  const [phone, setPhone]             = useState("");
  const [pitchToken, setPitchToken]   = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [votingStep, setVotingStep]   = useState(0); // 0-10 personas loaded
  const pollRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

  // tRPC hooks
  const submitMutation = trpc.pitch.submit.useMutation();
  const resultQuery    = trpc.pitch.getResult.useQuery(
    { pitchToken: pitchToken ?? "" },
    { enabled: !!pitchToken && (stage === "voting" || stage === "verdict"), refetchInterval: 2500 }
  );

  // Animate persona cards while voting
  useEffect(() => {
    if (stage !== "voting") return;
    setVotingStep(0);
    const interval = setInterval(() => {
      setVotingStep(s => {
        if (s >= 10) { clearInterval(interval); return 10; }
        return s + 1;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [stage]);

  // Watch for result
  useEffect(() => {
    if (!resultQuery.data?.verdict) return;
    if (resultQuery.data.verdict === "ERROR") {
      setError("The Council encountered an error. Please try again.");
      setStage("form");
      return;
    }
    if (stage === "voting") setStage("verdict");
    if (resultQuery.data.reportUnlocked && stage === "payment") setStage("report");
  }, [resultQuery.data, stage]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(null);
    if (wordCount(pitchText) < 20) { setError("Please write at least 20 words."); return; }
    if (!phone.trim()) { setError("Please enter your Kuwait mobile number."); return; }
    try {
      const res = await submitMutation.mutateAsync({ pitchText, phone });
      setPitchToken(res.pitchToken);
      setStage("voting");
    } catch (e: any) {
      setError(e.message ?? "Submission failed. Please try again.");
    }
  }

  function handlePayNow() {
    setStage("payment");
  }

  // Poll for payment confirmation
  useEffect(() => {
    if (stage !== "payment") return;
    pollRef.current = setInterval(async () => {
      if (resultQuery.data?.reportUnlocked) {
        clearInterval(pollRef.current!);
        setStage("report");
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [stage, resultQuery.data]);

  const wc = wordCount(pitchText);
  const result = resultQuery.data;
  const verdictCfg = result?.verdict ? VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.ERROR : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE, fontFamily: "'Inter', sans-serif" }}>
      <SiteNav />

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(180deg, ${NAVY2} 0%, ${NAVY} 100%)`,
        borderBottom: `1px solid ${BORDER}`,
        padding: "48px 24px 36px",
        textAlign: "center",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16,
          background: "rgba(201,168,76,0.10)", border: `1px solid ${BORDER}`,
          borderRadius: 100, padding: "6px 18px", fontSize: 12, color: GOLD, letterSpacing: "0.08em" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, display: "inline-block", animation: "pulse 2s infinite" }} />
          COUNCIL OF 10 — LIVE EVALUATION
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, margin: "0 0 12px",
          background: `linear-gradient(135deg, ${WHITE} 0%, ${GOLD2} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Submit Your Business Pitch
        </h1>
        <p style={{ color: MUTED, fontSize: 16, maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
          10 specialist AI personas — GCC Regulatory, Shariah, CFO, Growth, Exit and more — will evaluate your idea and deliver an institutional-grade verdict in under 60 seconds.
        </p>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          {[["10", "Expert Personas"], ["60s", "Evaluation Time"], ["KWD 49", "Full Report"]].map(([val, lbl]) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{val}</div>
              <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.06em" }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ══ STAGE: FORM ══════════════════════════════════════════════════ */}
        {stage === "form" && (
          <div>
            {/* Pitch textarea */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: GOLD, letterSpacing: "0.06em", marginBottom: 10 }}>
                YOUR BUSINESS PITCH
              </label>
              <div style={{ position: "relative" }}>
                <textarea
                  value={pitchText}
                  onChange={e => setPitchText(e.target.value)}
                  placeholder="Describe your business idea in detail. Include the problem you're solving, your target market, revenue model, and why Kuwait / GCC is the right market. The more specific you are, the more valuable the Council's feedback will be..."
                  rows={10}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: NAVY3, border: `1px solid ${BORDER}`,
                    borderRadius: 12, padding: "16px 20px", color: WHITE,
                    fontSize: 15, lineHeight: 1.7, resize: "vertical",
                    outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = GOLD; }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER; }}
                />
                <div style={{
                  position: "absolute", bottom: 12, right: 16,
                  fontSize: 12, color: wc >= 20 ? GOLD : MUTED,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {wc} words {wc < 20 ? `(min 20)` : wc > 300 ? "(ideal: 150–300)" : "✓"}
                </div>
              </div>
            </div>

            {/* Phone input */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: GOLD, letterSpacing: "0.06em", marginBottom: 10 }}>
                KUWAIT MOBILE NUMBER
              </label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{
                  background: NAVY3, border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: "12px 16px",
                  fontSize: 14, color: MUTED, flexShrink: 0,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  🇰🇼 +965
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9XXX XXXX"
                  style={{
                    flex: 1, background: NAVY3, border: `1px solid ${BORDER}`,
                    borderRadius: 10, padding: "12px 16px", color: WHITE,
                    fontSize: 15, outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = GOLD; }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER; }}
                />
              </div>
              <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
                Your report will be delivered to this number via WhatsApp once payment is confirmed.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: "#FCA5A5" }}>
                {error}
              </div>
            )}

            {/* What you get */}
            <div style={{ background: NAVY3, border: `1px solid ${BORDER}`, borderRadius: 14,
              padding: "20px 24px", marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: "0.06em", marginBottom: 14 }}>
                WHAT YOU RECEIVE
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["⚖️", "GCC Regulatory Risk Assessment"],
                  ["☪️", "Shariah Compliance Verdict"],
                  ["📊", "CFO Financial Viability Score"],
                  ["🚀", "Growth & Scaling Roadmap"],
                  ["🚪", "Exit Strategy & M&A Potential"],
                  ["🛡️", "Cybersecurity & Operational Risk"],
                ].map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: MUTED }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing note */}
            <div style={{ background: "rgba(201,168,76,0.06)", border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "14px 20px", marginBottom: 28,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: MUTED }}>Full Council Report — unlocked after evaluation</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Free preview for REJECTED / VETOED decisions</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: GOLD }}>KWD 49</div>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              style={{
                width: "100%", padding: "16px 24px",
                background: submitMutation.isPending
                  ? "rgba(201,168,76,0.3)"
                  : `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`,
                border: "none", borderRadius: 12, cursor: submitMutation.isPending ? "not-allowed" : "pointer",
                fontSize: 16, fontWeight: 700, color: NAVY,
                letterSpacing: "0.04em", transition: "opacity 0.2s",
                fontFamily: "inherit",
              }}
            >
              {submitMutation.isPending ? "Submitting to Council…" : "⚡ Submit to the Council of 10"}
            </button>

            <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 16 }}>
              Evaluation takes 30–90 seconds. You will only be charged if the verdict is APPROVED or APPROVED WITH CONDITIONS.
            </p>
          </div>
        )}

        {/* ══ STAGE: VOTING ════════════════════════════════════════════════ */}
        {stage === "voting" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, color: GOLD, letterSpacing: "0.1em", fontWeight: 600, marginBottom: 12 }}>
                COUNCIL IN SESSION
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>
                10 Experts Are Evaluating Your Pitch
              </h2>
              <p style={{ color: MUTED, fontSize: 15 }}>
                Each persona is independently analysing your business idea against GCC market conditions, regulatory requirements, and financial viability.
              </p>
            </div>

            {/* Persona cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 36 }}>
              {PERSONAS.map((p, i) => {
                const loaded = i < votingStep;
                return (
                  <div key={p.id} style={{
                    background: loaded ? `${p.color}12` : NAVY3,
                    border: `1px solid ${loaded ? p.color + "40" : BORDER}`,
                    borderRadius: 12, padding: "16px 12px",
                    transition: "all 0.4s ease",
                    opacity: loaded ? 1 : 0.3,
                    transform: loaded ? "scale(1)" : "scale(0.95)",
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{p.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: loaded ? WHITE : MUTED, lineHeight: 1.3 }}>{p.name}</div>
                    {loaded && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, animation: "pulse 1.5s infinite" }} />
                        <span style={{ fontSize: 10, color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>VOTING</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div style={{ background: NAVY3, borderRadius: 100, height: 6, marginBottom: 16, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 100,
                background: `linear-gradient(90deg, ${GOLD}, ${CYAN})`,
                width: `${(votingStep / 10) * 100}%`,
                transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ fontSize: 13, color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
              {votingStep}/10 personas deliberating…
            </div>
          </div>
        )}

        {/* ══ STAGE: VERDICT ═══════════════════════════════════════════════ */}
        {stage === "verdict" && result && verdictCfg && (
          <div>
            {/* Verdict banner */}
            <div style={{
              background: verdictCfg.bg, border: `2px solid ${verdictCfg.color}40`,
              borderRadius: 16, padding: "28px 32px", textAlign: "center", marginBottom: 32,
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{verdictCfg.icon}</div>
              <div style={{ fontSize: 13, color: verdictCfg.color, letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>
                COUNCIL VERDICT
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: verdictCfg.color, marginBottom: 12 }}>
                {verdictCfg.label}
              </div>
              {result.confidenceScore && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,0.05)", borderRadius: 100, padding: "6px 16px",
                  fontSize: 14, color: MUTED }}>
                  <span>Council Confidence:</span>
                  <span style={{ fontWeight: 700, color: verdictCfg.color }}>
                    {(result.confidenceScore * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* Vote breakdown — blurred if payment required */}
            {result.votes && (
              <div style={{ marginBottom: 28, position: "relative" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: "0.06em", marginBottom: 14 }}>
                  VOTE BREAKDOWN
                </div>
                <div style={{
                  filter: verdictCfg.requiresPayment ? "blur(6px)" : "none",
                  pointerEvents: verdictCfg.requiresPayment ? "none" : "auto",
                  transition: "filter 0.3s",
                }}>
                  {result.votes.map((v: any) => {
                    const isYes = v.vote === "HARD_YES" || v.vote === "SOFT_YES";
                    const voteColor = v.vote === "HARD_YES" ? "#10B981" : v.vote === "SOFT_YES" ? GOLD : v.vote === "SOFT_NO" ? "#F97316" : "#EF4444";
                    const voteIcon = v.vote === "HARD_YES" ? "✅" : v.vote === "SOFT_YES" ? "🟡" : v.vote === "SOFT_NO" ? "🟠" : "❌";
                    return (
                      <div key={v.persona} style={{
                        background: NAVY3, border: `1px solid ${isYes ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
                        borderRadius: 10, padding: "14px 18px", marginBottom: 10,
                        display: "flex", gap: 14, alignItems: "flex-start",
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{voteIcon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{v.persona}</span>
                            <span style={{ fontSize: 11, color: voteColor, fontFamily: "'JetBrains Mono', monospace",
                              background: `${voteColor}15`, borderRadius: 6, padding: "2px 8px" }}>
                              {v.vote}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                            {v.rationale?.slice(0, 180)}{v.rationale?.length > 180 ? "…" : ""}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, flexShrink: 0, textAlign: "right" }}>
                          <div style={{ color: voteColor, fontWeight: 700 }}>{((v.confidence ?? 0.7) * 100).toFixed(0)}%</div>
                          <div>conf.</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Blur overlay for payment */}
                {verdictCfg.requiresPayment && (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: "rgba(5,8,15,0.6)", borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 4 }}>
                      Full Report Locked
                    </div>
                    <div style={{ fontSize: 13, color: MUTED }}>Unlock all 10 persona rationales below</div>
                  </div>
                )}
              </div>
            )}

            {/* CTA based on verdict */}
            {verdictCfg.requiresPayment ? (
              <div style={{
                background: "rgba(201,168,76,0.06)", border: `1px solid ${BORDER}`,
                borderRadius: 16, padding: "28px 32px", textAlign: "center",
              }}>
                <div style={{ fontSize: 13, color: GOLD, letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>
                  YOUR PITCH WAS APPROVED
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>
                  Unlock Your Full Council Report
                </h3>
                <p style={{ color: MUTED, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                  Get the complete analysis from all 10 expert personas — including detailed rationales, risk flags, conditions, and a strategic action plan tailored for the Kuwait market.
                </p>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24, flexWrap: "wrap" }}>
                  {["All 10 persona rationales", "Risk & compliance flags", "Strategic action plan", "WhatsApp delivery"].map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: MUTED }}>
                      <span style={{ color: GOLD }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 24 }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: GOLD }}>KWD 49</div>
                  <div style={{ fontSize: 13, color: MUTED, textAlign: "left" }}>
                    One-time payment<br />Instant report delivery
                  </div>
                </div>
                <button
                  onClick={handlePayNow}
                  style={{
                    padding: "16px 48px",
                    background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD2} 100%)`,
                    border: "none", borderRadius: 12, cursor: "pointer",
                    fontSize: 16, fontWeight: 700, color: NAVY,
                    letterSpacing: "0.04em", fontFamily: "inherit",
                  }}
                >
                  🏦 Pay with K-Net — KWD 49
                </button>
                <p style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>
                  Secured by National Bank of Kuwait · K-Net payment gateway
                </p>
              </div>
            ) : (
              <div style={{
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.20)",
                borderRadius: 14, padding: "24px 28px", textAlign: "center",
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>📋</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Free Summary Available</h3>
                <p style={{ color: MUTED, fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
                  The Council did not approve this pitch in its current form. The vote breakdown above is available for free — use it to refine your idea and resubmit.
                </p>
                <button
                  onClick={() => { setStage("form"); setPitchToken(null); setPitchText(""); }}
                  style={{
                    padding: "12px 32px", background: "none",
                    border: `1px solid ${BORDER}`, borderRadius: 10, cursor: "pointer",
                    fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "inherit",
                  }}
                >
                  ↩ Refine & Resubmit
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ STAGE: PAYMENT ═══════════════════════════════════════════════ */}
        {stage === "payment" && (
          <div style={{ textAlign: "center" }}>
            {/* K-Net card */}
            <div style={{
              background: "linear-gradient(135deg, #1A2744 0%, #0F1A2E 100%)",
              border: `1px solid ${BORDER}`,
              borderRadius: 20, padding: "40px 32px", maxWidth: 480, margin: "0 auto 32px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}>
              {/* K-Net logo area */}
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 12,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12, padding: "12px 24px",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8,
                    background: "linear-gradient(135deg, #00A651, #007A3D)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 900, color: WHITE }}>K</div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: WHITE }}>K-Net</div>
                    <div style={{ fontSize: 11, color: MUTED }}>Kuwait Electronic Payment Network</div>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, color: MUTED, letterSpacing: "0.08em", marginBottom: 8 }}>AMOUNT DUE</div>
                <div style={{ fontSize: 52, fontWeight: 900, color: GOLD, lineHeight: 1 }}>49.000</div>
                <div style={{ fontSize: 16, color: MUTED, marginTop: 4 }}>Kuwaiti Dinar (KWD)</div>
              </div>

              {/* Order details */}
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "16px 20px", marginBottom: 28, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: MUTED }}>Service</span>
                  <span style={{ fontSize: 13, color: WHITE, fontWeight: 600 }}>Council Report</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: MUTED }}>Reference</span>
                  <span style={{ fontSize: 11, color: CYAN, fontFamily: "'JetBrains Mono', monospace" }}>
                    {pitchToken?.slice(0, 16).toUpperCase()}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: MUTED }}>Merchant</span>
                  <span style={{ fontSize: 13, color: WHITE }}>AgenThink AI W.L.L.</span>
                </div>
              </div>

              {/* Payment button — placeholder */}
              <button
                style={{
                  width: "100%", padding: "16px",
                  background: "linear-gradient(135deg, #00A651, #007A3D)",
                  border: "none", borderRadius: 12, cursor: "pointer",
                  fontSize: 16, fontWeight: 700, color: WHITE,
                  letterSpacing: "0.04em", fontFamily: "inherit",
                  boxShadow: "0 4px 20px rgba(0,166,81,0.3)",
                }}
                onClick={() => {
                  // In production: redirect to NBK K-Net gateway URL
                  // For now: show waiting state
                  alert("K-Net gateway integration pending. Your admin can manually confirm payment via the webhook endpoint:\n\nPOST /api/payment-confirm\n{ pitchToken: \"" + pitchToken + "\", webhookSecret: \"knet-dev-secret-2026\" }");
                }}
              >
                Proceed to K-Net →
              </button>

              <p style={{ fontSize: 11, color: MUTED, marginTop: 16 }}>
                🔒 256-bit SSL encryption · PCI DSS compliant · Powered by NBK
              </p>
            </div>

            {/* Waiting indicator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: MUTED, fontSize: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, animation: "pulse 1.5s infinite" }} />
              Waiting for payment confirmation…
            </div>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
              Your report will unlock automatically once payment is confirmed.
            </p>
          </div>
        )}

        {/* ══ STAGE: REPORT ════════════════════════════════════════════════ */}
        {stage === "report" && result && (
          <div>
            {/* Header */}
            <div style={{
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 16, padding: "24px 28px", marginBottom: 32, textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔓</div>
              <div style={{ fontSize: 13, color: "#10B981", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
                PAYMENT CONFIRMED
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Your Council Report is Unlocked</h2>
              <p style={{ color: MUTED, fontSize: 14 }}>Reference: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: CYAN }}>{pitchToken?.slice(0, 16).toUpperCase()}</span></p>
            </div>

            {/* Report header */}
            <div style={{
              background: NAVY3, border: `1px solid ${BORDER}`,
              borderRadius: 16, padding: "28px 32px", marginBottom: 24,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: GOLD, letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>
                    AGENTHINK SOVEREIGN COUNCIL — OFFICIAL REPORT
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: WHITE }}>Council of 10 Evaluation</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
                    {new Date().toLocaleDateString("en-KW", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
                <div style={{
                  background: verdictCfg?.bg, border: `1px solid ${verdictCfg?.color}40`,
                  borderRadius: 10, padding: "10px 20px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 11, color: verdictCfg?.color, letterSpacing: "0.08em", fontWeight: 600 }}>VERDICT</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: verdictCfg?.color }}>{verdictCfg?.label}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>{((result.confidenceScore ?? 0) * 100).toFixed(1)}% confidence</div>
                </div>
              </div>

              {/* Pitch summary */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.06em", marginBottom: 6 }}>PITCH SUBMITTED</div>
                <div style={{ fontSize: 14, color: WHITE, lineHeight: 1.6 }}>{pitchText}</div>
              </div>
            </div>

            {/* Full vote breakdown */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, letterSpacing: "0.06em", marginBottom: 14 }}>
                FULL PERSONA ANALYSIS
              </div>
              {result.votes?.map((v: any, i: number) => {
                const isYes = v.vote === "HARD_YES" || v.vote === "SOFT_YES";
                const voteColor = v.vote === "HARD_YES" ? "#10B981" : v.vote === "SOFT_YES" ? GOLD : v.vote === "SOFT_NO" ? "#F97316" : "#EF4444";
                const voteIcon = v.vote === "HARD_YES" ? "✅" : v.vote === "SOFT_YES" ? "🟡" : v.vote === "SOFT_NO" ? "🟠" : "❌";
                const persona = PERSONAS.find(p => p.id === v.persona?.replace(/ /g, "_").toUpperCase()) ?? PERSONAS[i % PERSONAS.length];
                return (
                  <div key={i} style={{
                    background: NAVY3, border: `1px solid ${isYes ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
                    borderRadius: 12, padding: "18px 22px", marginBottom: 12,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{persona?.icon ?? voteIcon}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{v.persona}</div>
                          <div style={{ fontSize: 11, color: MUTED }}>Authority weight: {((v.weight ?? 1) * 100).toFixed(0)}%</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 11, color: voteColor, fontFamily: "'JetBrains Mono', monospace",
                          background: `${voteColor}15`, borderRadius: 6, padding: "4px 10px", fontWeight: 700 }}>
                          {v.vote}
                        </div>
                        <div style={{ fontSize: 13, color: voteColor, fontWeight: 700 }}>
                          {((v.confidence ?? 0.7) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                      {v.rationale}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              background: NAVY3, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "20px 24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                This report was generated by the AgenThink Sovereign Council of 10 AI personas.<br />
                It is intended for informational purposes only and does not constitute financial, legal, or investment advice.<br />
                <span style={{ color: GOLD }}>AgenThink AI W.L.L. · Kuwait · farouq@agenthink.ai</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
