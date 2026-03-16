/**
 * GameTheoryAgent.tsx
 * Game Theory Investment Decision Agent
 * Single input → BUY / SELL / HOLD verdict + 6 institutional panels
 * Dark navy, teal accents, Inter font, mobile-first
 */
import { useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GameTheoryResult {
  verdict: "BUY" | "SELL" | "HOLD";
  verdictRationale: string;
  gameTheoryRead: string;
  firstMoverAssessment: string;
  equilibrium: string;
  verdictChangingSignal: string;
  confidence: "High" | "Medium" | "Low";
  confidenceRationale: string;
}

// ─── Verdict styles ───────────────────────────────────────────────────────────
const VERDICT_STYLE = {
  BUY:  { color: "#00C8B4", glow: "0 0 60px rgba(0,200,180,0.35)", label: "BUY" },
  SELL: { color: "#EF4444", glow: "0 0 60px rgba(239,68,68,0.35)",  label: "SELL" },
  HOLD: { color: "#F59E0B", glow: "0 0 60px rgba(245,158,11,0.35)", label: "HOLD" },
};

const CONFIDENCE_COLOR = { High: "#00C8B4", Medium: "#F59E0B", Low: "#EF4444" };

// ─── Example prompts ──────────────────────────────────────────────────────────
const EXAMPLES = [
  "I hold a position in a Kuwait real estate fund. The Iran conflict has disrupted regional sentiment. Other GCC funds appear to be reassessing exposure. Do I sell now, buy the dip, or hold?",
  "We are considering increasing our allocation to Saudi Aramco equity ahead of Q2 earnings. PIF has been buying. International funds are reducing EM exposure. What does game theory say?",
  "Our family office holds Dubai commercial real estate. Vacancy rates are rising but sovereign buyers are still active. Do we exit before the market softens or hold for the sovereign floor?",
];

// ─── Panel component ──────────────────────────────────────────────────────────
function Panel({ label, icon, content, accent = "#1E2D4A" }: { label: string; icon: string; content: string; accent?: string }) {
  return (
    <div style={{
      background: "#0F1E35",
      border: `1px solid ${accent}`,
      borderRadius: 12,
      padding: "20px 22px",
    }}>
      <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A7DB5", letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.75, color: "#C8D8EE", margin: 0 }}>{content}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GameTheoryAgent() {
  const [situation, setSituation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameTheoryResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleAnalyse() {
    if (!situation.trim() || situation.trim().length < 20) {
      setError("Please describe your investment situation in at least 20 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch("/api/agents/game-theory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation: situation.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Analysis failed");
      setResult(data as GameTheoryResult);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const vs = result ? VERDICT_STYLE[result.verdict] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#070D1A", color: "#E2E8F0", fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ background: "#0B1628", borderBottom: "1px solid #1E2D4A", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>♟️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#E2E8F0" }}>Game Theory Investment Decision Agent</div>
            <div style={{ fontSize: 11, color: "#4A7DB5", fontFamily: "monospace" }}>FINANCE · GCC INSTITUTIONAL STRATEGY</div>
          </div>
        </div>
        <a href="/persona-setup" style={{ fontSize: 12, color: "#4A7DB5", textDecoration: "none" }}>← Back</a>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", letterSpacing: 2, marginBottom: 12 }}>INSTITUTIONAL DECISION INTELLIGENCE</div>
          <h1 style={{ fontSize: "clamp(24px, 5vw, 38px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 12px", lineHeight: 1.15 }}>
            What does the game say?
          </h1>
          <p style={{ fontSize: 14, color: "#8BA3C4", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            Describe your investment situation. The agent returns a clear verdict — Buy, Sell, or Hold — by modelling what other rational institutional actors are likely to do and whether that changes your optimal move.
          </p>
        </div>

        {/* ── Input ── */}
        <div style={{ background: "#0B1628", border: "1px solid #1E2D4A", borderRadius: 14, padding: "20px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A7DB5", letterSpacing: 1.5, marginBottom: 10 }}>YOUR INVESTMENT SITUATION</div>
          <textarea
            value={situation}
            onChange={e => setSituation(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAnalyse(); }}
            placeholder="Describe your situation — the asset, your current position, what other actors appear to be doing, and the decision you face. Be specific."
            style={{
              width: "100%", minHeight: 110, background: "transparent", border: "none",
              color: "#E2E8F0", fontSize: 14, lineHeight: 1.7, resize: "vertical",
              fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#2A3D5A", fontFamily: "monospace" }}>
              {situation.length}/3000 · ⌘↵ to run
            </span>
            <button
              onClick={handleAnalyse}
              disabled={loading || situation.trim().length < 20}
              style={{
                background: loading || situation.trim().length < 20 ? "#1E2D4A" : "linear-gradient(135deg, #00C8B4, #4A7DB5)",
                color: loading || situation.trim().length < 20 ? "#4A7DB5" : "#fff",
                border: "none", borderRadius: 10, padding: "11px 28px",
                fontWeight: 700, fontSize: 14, cursor: loading || situation.trim().length < 20 ? "not-allowed" : "pointer",
                transition: "all 0.2s", fontFamily: "'Inter', sans-serif",
              }}
            >
              {loading ? "⏳ Analysing…" : "♟️ Get Verdict"}
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: "#2D0A0A", border: "1px solid #EF4444", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#EF4444", marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Example prompts ── */}
        {!result && !loading && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#2A3D5A", letterSpacing: 1.5, marginBottom: 10 }}>EXAMPLE SITUATIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setSituation(ex)}
                  style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid #1E2D4A",
                    borderRadius: 8, padding: "10px 14px", textAlign: "left",
                    color: "#8BA3C4", fontSize: 12, lineHeight: 1.6, cursor: "pointer",
                    fontFamily: "'Inter', sans-serif", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#00C8B440"; (e.currentTarget as HTMLButtonElement).style.color = "#C8D8EE"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E2D4A"; (e.currentTarget as HTMLButtonElement).style.color = "#8BA3C4"; }}
                >
                  "{ex.slice(0, 120)}…"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 2s linear infinite", display: "inline-block" }}>♟️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#8BA3C4", marginBottom: 6 }}>Modelling the game…</div>
            <div style={{ fontSize: 12, color: "#4A7DB5", lineHeight: 1.8 }}>
              Identifying players · Mapping dominant strategies · Assessing first mover · Computing equilibrium
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {result && vs && (
          <div ref={resultRef}>

            {/* Verdict — large, centered, unambiguous */}
            <div style={{
              textAlign: "center",
              background: "#0B1628",
              border: `1px solid ${vs.color}40`,
              borderRadius: 16,
              padding: "40px 24px 32px",
              marginBottom: 20,
              boxShadow: vs.glow,
            }}>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", letterSpacing: 2, marginBottom: 16 }}>VERDICT</div>
              <div style={{
                fontSize: "clamp(72px, 18vw, 120px)",
                fontWeight: 900,
                color: vs.color,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                marginBottom: 20,
                textShadow: vs.glow,
              }}>
                {result.verdict}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "#C8D8EE", maxWidth: 560, margin: "0 auto" }}>
                {result.verdictRationale}
              </p>
              {/* Confidence pill */}
              <div style={{ marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8, background: "#0F1E35", border: `1px solid ${CONFIDENCE_COLOR[result.confidence]}40`, borderRadius: 20, padding: "6px 16px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: CONFIDENCE_COLOR[result.confidence], display: "inline-block" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: CONFIDENCE_COLOR[result.confidence], fontFamily: "monospace" }}>
                  {result.confidence.toUpperCase()} CONFIDENCE
                </span>
                <span style={{ fontSize: 12, color: "#8BA3C4" }}>— {result.confidenceRationale}</span>
              </div>
            </div>

            {/* 4 game theory panels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, marginBottom: 14 }}>
              <Panel
                label="WHO IS PLAYING"
                icon="👥"
                content={result.gameTheoryRead}
                accent="#1E3A5A"
              />
              <Panel
                label="FIRST MOVER ASSESSMENT"
                icon="⚡"
                content={result.firstMoverAssessment}
                accent="#1E3A5A"
              />
              <Panel
                label="EQUILIBRIUM"
                icon="⚖️"
                content={result.equilibrium}
                accent="#1E3A5A"
              />
              {/* Verdict-changing signal — full width, highlighted */}
              <div style={{
                background: "#0A2D14",
                border: `1px solid ${vs.color}30`,
                borderRadius: 12,
                padding: "20px 22px",
              }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A7DB5", letterSpacing: 1.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🔄</span>
                  <span>SIGNAL THAT CHANGES THIS VERDICT</span>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: vs.color, margin: 0, fontWeight: 600 }}>
                  {result.verdictChangingSignal}
                </p>
              </div>
            </div>

            {/* Reset */}
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <button
                onClick={() => { setResult(null); setSituation(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{
                  background: "transparent", border: "1px solid #1E2D4A", borderRadius: 8,
                  color: "#8BA3C4", fontSize: 13, padding: "10px 24px", cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", transition: "all 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#00C8B440"; (e.currentTarget as HTMLButtonElement).style.color = "#E2E8F0"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E2D4A"; (e.currentTarget as HTMLButtonElement).style.color = "#8BA3C4"; }}
              >
                ↑ New situation
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea:focus { outline: none; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
