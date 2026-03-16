import { useLocation } from "wouter";

const ETF_HTML_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663268376562/7EnctkaNppkKLbjFfnH6YY/AgenThinkMesh_ETF_Studio_aa59be69.html";

export default function ETFStudio() {
  const [, navigate] = useLocation();

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
      {/* Top bar with back button */}
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
        }}
      >
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 4,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#C9A84C",
              boxShadow: "0 0 6px #C9A84C",
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#C9A84C",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            ETF Launch Studio
          </span>
          <span
            style={{
              fontSize: 10,
              color: "rgba(201,168,76,0.5)",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.08em",
            }}
          >
            · 5 STAGES · 7 AGENTS · 7 ML MODELS
          </span>
        </div>
      </div>

      {/* Full-screen iframe */}
      <iframe
        src={ETF_HTML_URL}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "#0A1628",
        }}
        title="ETF Launch Studio"
        allow="clipboard-write"
      />
    </div>
  );
}
