import { useState } from "react";
import { useLocation } from "wouter";

// Use the server-side proxy so the HTML is served with text/html Content-Type.
// The CDN stores the file as application/octet-stream which causes browsers to download it.
const ETF_HTML_URL = "/api/etf/studio-html";

const SHARE_TEXT = `AgenThinkMesh — ETF Launch Studio

AI-powered ETF design workflow for Boursa Kuwait Premier Market.
• Shariah screening (AAOIFI Std 21) — 15 BK Premier constituents
• Macro overlay — RISK_OFF signal (oil momentum −7.2%)
• 10-year walk-forward backtest — 14.7% CAGR vs 11.2% BK All Share
• NAV accounting — live iNAV with intraday drift model

Launch the studio: https://agenthink-7enctkan.manus.space/agents/etf-studio

Built on AgenThinkMesh · agenthink.ai`;

export default function ETFStudio() {
  const [, navigate] = useLocation();
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(SHARE_TEXT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleWhatsApp() {
    const encoded = encodeURIComponent(SHARE_TEXT);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }

  function handleEmail() {
    const subject = encodeURIComponent("AgenThinkMesh — ETF Launch Studio");
    const body = encodeURIComponent(SHARE_TEXT);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0A1628",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          background: "#0A1628",
          borderBottom: "1px solid rgba(201,168,76,0.2)",
          flexShrink: 0,
          zIndex: 10000,
          position: "relative",
        }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate("/domain/Finance")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "rgba(201,168,76,0.1)",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 8,
            color: "#C9A84C",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Finance Domain
        </button>

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4, flex: 1 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9A84C", boxShadow: "0 0 6px #C9A84C" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", fontFamily: "Inter, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            ETF Launch Studio
          </span>
          <span style={{ fontSize: 10, color: "rgba(201,168,76,0.5)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>
            · 5 STAGES · 7 AGENTS · 7 ML MODELS
          </span>
        </div>

        {/* Partner CRM link */}
        <button
          onClick={() => navigate("/etf/partners")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px",
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.25)",
            borderRadius: 8,
            color: "#4ADE80",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          Partners
        </button>

        {/* Share button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShareOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px",
              background: shareOpen ? "rgba(56,189,248,0.15)" : "rgba(56,189,248,0.08)",
              border: "1px solid rgba(56,189,248,0.3)",
              borderRadius: 8,
              color: "#38BDF8",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "Inter, sans-serif", letterSpacing: "0.02em",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>

          {/* Share dropdown */}
          {shareOpen && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "#0F1E35",
                border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: 12,
                padding: 16,
                width: 280,
                boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                zIndex: 10001,
              }}
            >
              <div style={{ fontSize: 11, color: "rgba(240,244,250,0.4)", fontFamily: "monospace", marginBottom: 12, letterSpacing: "0.1em" }}>
                SHARE THIS STUDIO
              </div>

              {/* Preview text */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8, padding: "10px 12px",
                fontSize: 11, color: "rgba(240,244,250,0.55)",
                fontFamily: "monospace", lineHeight: 1.6,
                marginBottom: 12, whiteSpace: "pre-wrap",
                maxHeight: 100, overflow: "hidden",
              }}>
                {SHARE_TEXT.slice(0, 180)}…
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={handleWhatsApp}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px",
                    background: "rgba(37,211,102,0.1)",
                    border: "1px solid rgba(37,211,102,0.25)",
                    borderRadius: 8, cursor: "pointer",
                    color: "#25D366", fontSize: 13, fontWeight: 600,
                    fontFamily: "Inter, sans-serif", textAlign: "left",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.845L0 24l6.336-1.498A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.5-5.24-1.375L2.5 21.5l.906-4.13A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  Send via WhatsApp
                </button>

                <button
                  onClick={handleEmail}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px",
                    background: "rgba(56,189,248,0.08)",
                    border: "1px solid rgba(56,189,248,0.2)",
                    borderRadius: 8, cursor: "pointer",
                    color: "#38BDF8", fontSize: 13, fontWeight: 600,
                    fontFamily: "Inter, sans-serif", textAlign: "left",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Send via Email
                </button>

                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px",
                    background: copied ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 8, cursor: "pointer",
                    color: copied ? "#4ADE80" : "rgba(240,244,250,0.6)",
                    fontSize: 13, fontWeight: 600,
                    fontFamily: "Inter, sans-serif", textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {copied
                      ? <><polyline points="20 6 9 17 4 12"/></>
                      : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>
                    }
                  </svg>
                  {copied ? "Copied!" : "Copy to clipboard"}
                </button>
              </div>

              {/* Close */}
              <button
                onClick={() => setShareOpen(false)}
                style={{
                  position: "absolute", top: 10, right: 10,
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(240,244,250,0.3)", fontSize: 16, lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen iframe */}
      <iframe
        src={ETF_HTML_URL}
        style={{ flex: 1, width: "100%", border: "none", background: "#0A1628" }}
        title="ETF Launch Studio"
        allow="clipboard-write"
      />
    </div>
  );
}
