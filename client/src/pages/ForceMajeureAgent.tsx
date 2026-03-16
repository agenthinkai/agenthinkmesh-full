/**
 * ForceMajeureAgent.tsx
 * Force Majeure Contract Agent — Two-panel institutional UI
 * Left: contract upload + context | Right: structured 4-layer output
 * Dark navy + teal, Inter font, Arabic RTL support, PDF export
 */
import { useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TriggerAssessment {
  verdict: "YES" | "PARTIAL" | "NO";
  confidence: number;
  reasoning: string;
  triggeringEvents: string[];
  gaps: string[];
  clauseStrength: string;
}
interface RiskSummary {
  clauseStrength: { rating: string; summary: string };
  triggerConfidence: { percentage: number; summary: string };
  counterpartyExposure: { level: string; summary: string };
  recommendedNextAction: { action: string; detail: string };
}
interface AnalysisResult {
  success: boolean;
  contractLanguage: string;
  extractedClause: string;
  clauseNotFound: boolean;
  triggerAssessment: TriggerAssessment;
  notificationLetter: string;
  riskSummary: RiskSummary;
}

// ─── Verdict colour map ───────────────────────────────────────────────────────
const VERDICT_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  YES:     { bg: "#2D0A0A", border: "#EF4444", text: "#EF4444", label: "TRIGGERED — YES" },
  PARTIAL: { bg: "#2D1A00", border: "#F59E0B", text: "#F59E0B", label: "PARTIALLY TRIGGERED" },
  NO:      { bg: "#0A2D14", border: "#22C55E", text: "#22C55E", label: "NOT TRIGGERED — NO" },
};
const LEVEL_COLOR: Record<string, string> = { HIGH: "#EF4444", MEDIUM: "#F59E0B", LOW: "#22C55E", STRONG: "#22C55E", MODERATE: "#F59E0B", WEAK: "#EF4444" };

// ─── Component ────────────────────────────────────────────────────────────────
export default function ForceMajeureAgent() {
  const [file, setFile] = useState<File | null>(null);
  const [userContext, setUserContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"clause" | "verdict" | "letter" | "summary">("clause");
  const [letterEditable, setLetterEditable] = useState(false);
  const [letterText, setLetterText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const isArabic = result?.contractLanguage === "Arabic";

  async function handleAnalyse() {
    if (!file) { setError("Please upload a contract file."); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("contract", file);
      formData.append("userContext", userContext);
      const resp = await fetch("/api/agents/force-majeure", { method: "POST", body: formData });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Analysis failed");
      setResult(data as AnalysisResult);
      setLetterText(data.notificationLetter || "");
      setActiveTab("clause");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    if (!result) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const v = result.triggerAssessment;
    const rs = result.riskSummary;
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(10, 20, 40);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(0, 200, 180);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("FORCE MAJEURE CONTRACT ANALYSIS", pageW / 2, 14, { align: "center" });
    doc.setTextColor(150, 170, 200);
    doc.setFontSize(8);
    doc.text(`AgenThinkMesh · Legal Intelligence · ${new Date().toLocaleDateString()}`, pageW / 2, 22, { align: "center" });
    y = 40;

    const addSection = (title: string, body: string) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 200, 180);
      doc.text(title, 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 50, 70);
      const lines = doc.splitTextToSize(body, pageW - 28);
      doc.text(lines, 14, y); y += lines.length * 4.5 + 6;
      if (y > 260) { doc.addPage(); y = 20; }
    };

    addSection("EXTRACTED FORCE MAJEURE CLAUSE", result.extractedClause.slice(0, 1200));
    addSection(`TRIGGER VERDICT: ${v.verdict}  (Confidence: ${v.confidence}%)`, v.reasoning);
    addSection("TRIGGERING EVENTS", (v.triggeringEvents || []).join("\n"));
    if ((v.gaps || []).length) addSection("GAPS / LIMITATIONS", v.gaps.join("\n"));
    addSection("NOTIFICATION LETTER", letterText.slice(0, 2000));
    addSection("RISK SUMMARY — CLAUSE STRENGTH", `${rs.clauseStrength.rating}: ${rs.clauseStrength.summary}`);
    addSection("RISK SUMMARY — TRIGGER CONFIDENCE", `${rs.triggerConfidence.percentage}%: ${rs.triggerConfidence.summary}`);
    addSection("RISK SUMMARY — COUNTERPARTY EXPOSURE", `${rs.counterpartyExposure.level}: ${rs.counterpartyExposure.summary}`);
    addSection("RECOMMENDED NEXT ACTION", `${rs.recommendedNextAction.action}: ${rs.recommendedNextAction.detail}`);

    doc.save(`ForceMajeure-Analysis-${Date.now()}.pdf`);
  }

  const vs = result ? (VERDICT_STYLE[result.triggerAssessment.verdict] || VERDICT_STYLE.PARTIAL) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#070D1A", color: "#E2E8F0", fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: "#0B1628", borderBottom: "1px solid #1E2D4A", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚖️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#E2E8F0" }}>Force Majeure Contract Agent</div>
            <div style={{ fontSize: 11, color: "#4A7DB5", fontFamily: "monospace" }}>LEGAL · GCC CONFLICT INTELLIGENCE</div>
          </div>
        </div>
        {result && (
          <button onClick={handleExportPDF} style={{ background: "linear-gradient(135deg, #00C8B4, #4A7DB5)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            ↓ Export PDF
          </button>
        )}
      </div>

      {/* Two-panel layout */}
      <div style={{ display: "grid", gridTemplateColumns: result ? "380px 1fr" : "1fr", gap: 0, minHeight: "calc(100vh - 57px)" }}>

        {/* LEFT PANEL — Upload + Context */}
        <div style={{ background: "#0B1628", borderRight: "1px solid #1E2D4A", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", marginBottom: 8, letterSpacing: 1 }}>STEP 1 — UPLOAD CONTRACT</div>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${file ? "#00C8B4" : "#1E2D4A"}`,
                borderRadius: 10, padding: "28px 16px", textAlign: "center", cursor: "pointer",
                background: file ? "rgba(0,200,180,0.05)" : "rgba(255,255,255,0.02)",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{file ? "📄" : "⬆️"}</div>
              {file ? (
                <>
                  <div style={{ fontWeight: 600, color: "#00C8B4", fontSize: 13 }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: "#4A7DB5", marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · Click to replace</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, color: "#8BA3C4", fontSize: 13 }}>Drop PDF or DOCX here</div>
                  <div style={{ fontSize: 11, color: "#4A7DB5", marginTop: 4 }}>Arabic & English · Max 16 MB</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); } }} />
          </div>

          <div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", marginBottom: 8, letterSpacing: 1 }}>STEP 2 — PROVIDE CONTEXT</div>
            <textarea
              value={userContext}
              onChange={e => setUserContext(e.target.value)}
              placeholder={"Who you are, who the counterparty is, and what the contract covers.\n\nExample: We are Al Noor Logistics LLC (Dubai). Counterparty is Petroline SA (Iran). Contract covers crude oil transport through Hormuz, valued at $12M."}
              style={{
                width: "100%", minHeight: 130, background: "#0F1E35", border: "1px solid #1E2D4A",
                borderRadius: 8, color: "#E2E8F0", fontSize: 13, padding: "12px 14px",
                resize: "vertical", fontFamily: "'Inter', sans-serif", lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={handleAnalyse}
            disabled={loading || !file}
            style={{
              background: loading || !file ? "#1E2D4A" : "linear-gradient(135deg, #00C8B4, #4A7DB5)",
              color: loading || !file ? "#4A7DB5" : "#fff",
              border: "none", borderRadius: 10, padding: "14px 0", fontWeight: 700, fontSize: 14,
              cursor: loading || !file ? "not-allowed" : "pointer", width: "100%", transition: "all 0.2s",
            }}
          >
            {loading ? "⏳ Analysing Contract…" : "⚡ Run Force Majeure Analysis"}
          </button>

          {error && (
            <div style={{ background: "#2D0A0A", border: "1px solid #EF4444", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#EF4444" }}>
              ⚠️ {error}
            </div>
          )}

          {/* GCC Context Banner */}
          <div style={{ background: "#0F1E35", border: "1px solid #1E2D4A", borderRadius: 8, padding: "14px", fontSize: 11, color: "#8BA3C4", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: "#4A7DB5", marginBottom: 6, fontFamily: "monospace", letterSpacing: 1 }}>GCC CONFLICT CONDITIONS ASSESSED</div>
            <div>• US-Iran active military conflict</div>
            <div>• Strait of Hormuz disruption risk</div>
            <div>• Attacks on GCC ports, airports, energy</div>
            <div>• UAE & Saudi Arabia on elevated alert</div>
          </div>
        </div>

        {/* RIGHT PANEL — Output */}
        {result && (
          <div ref={outputRef} style={{ padding: "28px 32px", overflowY: "auto" }}>
            {/* Verdict Banner */}
            {vs && (
              <div style={{ background: vs.bg, border: `2px solid ${vs.border}`, borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: vs.text, letterSpacing: 2, marginBottom: 4 }}>TRIGGER VERDICT</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: vs.text }}>{vs.label}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#8BA3C4", fontFamily: "monospace" }}>CONFIDENCE</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: vs.text }}>{result.triggerAssessment.confidence}%</div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#0B1628", borderRadius: 10, padding: 4 }}>
              {(["clause", "verdict", "letter", "summary"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12,
                  background: activeTab === tab ? "#1E2D4A" : "transparent",
                  color: activeTab === tab ? "#00C8B4" : "#8BA3C4",
                  transition: "all 0.15s", fontFamily: "'Inter', sans-serif",
                }}>
                  {tab === "clause" ? "📋 Clause" : tab === "verdict" ? "⚖️ Verdict" : tab === "letter" ? "✉️ Letter" : "📊 Risk Summary"}
                </button>
              ))}
            </div>

            {/* Tab: Extracted Clause */}
            {activeTab === "clause" && (
              <div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", marginBottom: 12, letterSpacing: 1 }}>
                  EXTRACTED CLAUSE · {result.contractLanguage.toUpperCase()} CONTRACT
                  {result.clauseNotFound && <span style={{ color: "#EF4444", marginLeft: 8 }}>⚠ NOT FOUND</span>}
                </div>
                <div style={{
                  background: "#0F1E35", border: "1px solid #1E2D4A", borderRadius: 10, padding: "20px 24px",
                  fontSize: 14, lineHeight: 1.8, color: "#E2E8F0",
                  direction: isArabic ? "rtl" : "ltr", textAlign: isArabic ? "right" : "left",
                  fontFamily: isArabic ? "'Noto Sans Arabic', 'Inter', sans-serif" : "'Inter', sans-serif",
                  whiteSpace: "pre-wrap",
                }}>
                  {result.extractedClause}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", background: `${LEVEL_COLOR[result.triggerAssessment.clauseStrength] || "#F59E0B"}20`, border: `1px solid ${LEVEL_COLOR[result.triggerAssessment.clauseStrength] || "#F59E0B"}40`, color: LEVEL_COLOR[result.triggerAssessment.clauseStrength] || "#F59E0B", borderRadius: 6, padding: "3px 10px" }}>
                    CLAUSE STRENGTH: {result.triggerAssessment.clauseStrength}
                  </span>
                </div>
              </div>
            )}

            {/* Tab: Verdict + Reasoning */}
            {activeTab === "verdict" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "#0F1E35", border: "1px solid #1E2D4A", borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", marginBottom: 10, letterSpacing: 1 }}>LEGAL REASONING</div>
                  <p style={{ fontSize: 14, lineHeight: 1.8, color: "#E2E8F0", margin: 0 }}>{result.triggerAssessment.reasoning}</p>
                </div>
                {(result.triggerAssessment.triggeringEvents || []).length > 0 && (
                  <div style={{ background: "#0A2D14", border: "1px solid #22C55E30", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#22C55E", marginBottom: 10, letterSpacing: 1 }}>QUALIFYING TRIGGERING EVENTS</div>
                    {result.triggerAssessment.triggeringEvents.map((ev, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "#E2E8F0" }}>
                        <span style={{ color: "#22C55E", flexShrink: 0 }}>✓</span><span>{ev}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(result.triggerAssessment.gaps || []).length > 0 && (
                  <div style={{ background: "#2D1A00", border: "1px solid #F59E0B30", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#F59E0B", marginBottom: 10, letterSpacing: 1 }}>GAPS & LIMITATIONS</div>
                    {result.triggerAssessment.gaps.map((g, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 13, color: "#E2E8F0" }}>
                        <span style={{ color: "#F59E0B", flexShrink: 0 }}>△</span><span>{g}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Notification Letter */}
            {activeTab === "letter" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", letterSpacing: 1 }}>
                    DRAFT NOTIFICATION LETTER · {result.contractLanguage.toUpperCase()}
                  </div>
                  <button onClick={() => setLetterEditable(!letterEditable)} style={{ background: "transparent", border: "1px solid #1E2D4A", borderRadius: 6, color: "#8BA3C4", fontSize: 11, padding: "4px 12px", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                    {letterEditable ? "🔒 Lock" : "✏️ Edit"}
                  </button>
                </div>
                {letterEditable ? (
                  <textarea
                    value={letterText}
                    onChange={e => setLetterText(e.target.value)}
                    style={{
                      width: "100%", minHeight: 480, background: "#0F1E35", border: "1px solid #00C8B4",
                      borderRadius: 10, color: "#E2E8F0", fontSize: 13, padding: "20px 24px",
                      resize: "vertical", fontFamily: isArabic ? "'Noto Sans Arabic', 'Inter', sans-serif" : "'Inter', sans-serif",
                      lineHeight: 1.8, direction: isArabic ? "rtl" : "ltr", boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <div style={{
                    background: "#0F1E35", border: "1px solid #1E2D4A", borderRadius: 10, padding: "24px 28px",
                    fontSize: 13.5, lineHeight: 1.9, color: "#E2E8F0", whiteSpace: "pre-wrap",
                    direction: isArabic ? "rtl" : "ltr", textAlign: isArabic ? "right" : "left",
                    fontFamily: isArabic ? "'Noto Sans Arabic', 'Inter', sans-serif" : "'Inter', sans-serif",
                    minHeight: 400,
                  }}>
                    {letterText}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Risk Summary */}
            {activeTab === "summary" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { label: "CLAUSE STRENGTH", value: result.riskSummary.clauseStrength.rating, summary: result.riskSummary.clauseStrength.summary, icon: "🛡️" },
                  { label: "TRIGGER CONFIDENCE", value: `${result.riskSummary.triggerConfidence.percentage}%`, summary: result.riskSummary.triggerConfidence.summary, icon: "🎯" },
                  { label: "COUNTERPARTY EXPOSURE", value: result.riskSummary.counterpartyExposure.level, summary: result.riskSummary.counterpartyExposure.summary, icon: "⚡" },
                ].map(card => (
                  <div key={card.label} style={{ background: "#0F1E35", border: "1px solid #1E2D4A", borderRadius: 10, padding: "20px" }}>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A7DB5", marginBottom: 8, letterSpacing: 1 }}>{card.icon} {card.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: LEVEL_COLOR[card.value] || "#E2E8F0", marginBottom: 8 }}>{card.value}</div>
                    <p style={{ fontSize: 12, color: "#8BA3C4", lineHeight: 1.7, margin: 0 }}>{card.summary}</p>
                  </div>
                ))}
                {/* Recommended Next Action — full width */}
                <div style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg, #0A2D40, #0F1E35)", border: "1px solid #00C8B430", borderRadius: 10, padding: "20px 24px" }}>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#00C8B4", marginBottom: 8, letterSpacing: 1 }}>🚀 RECOMMENDED NEXT ACTION</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>{result.riskSummary.recommendedNextAction.action}</div>
                  <p style={{ fontSize: 13, color: "#8BA3C4", lineHeight: 1.7, margin: 0 }}>{result.riskSummary.recommendedNextAction.detail}</p>
                  <button onClick={handleExportPDF} style={{ marginTop: 16, background: "linear-gradient(135deg, #00C8B4, #4A7DB5)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    ↓ Export Full Report as PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no result yet */}
        {!result && !loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, color: "#4A7DB5", textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>⚖️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#8BA3C4", marginBottom: 8 }}>Upload a contract to begin</div>
            <div style={{ fontSize: 13, color: "#4A7DB5", maxWidth: 360, lineHeight: 1.7 }}>
              The agent will extract the force majeure clause, assess GCC conflict triggers, draft a notification letter, and produce a board-ready risk summary.
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, color: "#4A7DB5", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 20, animation: "spin 2s linear infinite" }}>⚙️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#8BA3C4", marginBottom: 8 }}>Running 4-layer analysis…</div>
            <div style={{ fontSize: 12, color: "#4A7DB5", lineHeight: 1.8 }}>
              Layer 1: Extracting force majeure clause<br />
              Layer 2: Assessing GCC conflict triggers<br />
              Layer 3: Drafting notification letter<br />
              Layer 4: Generating risk summary
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea:focus { outline: none; }
        button:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
