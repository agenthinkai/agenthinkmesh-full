import { getLoginUrl } from "@/const";

export default function Landing() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Syne', sans-serif",
    }}>
      {/* Topbar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        height: 56,
        borderBottom: "1px solid #E2E8F0",
        background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "#1E293B", letterSpacing: "-0.02em" }}>
            AgenThink
          </span>
          <span style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
            / Mesh
          </span>
        </div>
        <a
          href={getLoginUrl()}
          style={{
            background: "#4F46E5",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 18px",
            fontSize: 12,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Sign in
        </a>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 32px",
      }}>
        <div style={{ maxWidth: 600, textAlign: "center" }}>
          {/* Mesh graphic */}
          <div style={{ marginBottom: 32, display: "flex", justifyContent: "center" }}>
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
              <circle cx="60" cy="40" r="10" fill="#4F46E5" opacity="0.9" />
              <circle cx="20" cy="20" r="6" fill="#4F46E5" opacity="0.5" />
              <circle cx="100" cy="20" r="6" fill="#4F46E5" opacity="0.5" />
              <circle cx="20" cy="60" r="6" fill="#4F46E5" opacity="0.5" />
              <circle cx="100" cy="60" r="6" fill="#4F46E5" opacity="0.5" />
              <circle cx="60" cy="10" r="5" fill="#4F46E5" opacity="0.4" />
              <circle cx="60" cy="70" r="5" fill="#4F46E5" opacity="0.4" />
              <line x1="60" y1="40" x2="20" y2="20" stroke="#4F46E5" strokeWidth="1.5" opacity="0.3" />
              <line x1="60" y1="40" x2="100" y2="20" stroke="#4F46E5" strokeWidth="1.5" opacity="0.3" />
              <line x1="60" y1="40" x2="20" y2="60" stroke="#4F46E5" strokeWidth="1.5" opacity="0.3" />
              <line x1="60" y1="40" x2="100" y2="60" stroke="#4F46E5" strokeWidth="1.5" opacity="0.3" />
              <line x1="60" y1="40" x2="60" y2="10" stroke="#4F46E5" strokeWidth="1.5" opacity="0.3" />
              <line x1="60" y1="40" x2="60" y2="70" stroke="#4F46E5" strokeWidth="1.5" opacity="0.3" />
            </svg>
          </div>

          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 38,
            color: "#1E293B",
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            marginBottom: 16,
          }}>
            Multi-domain AI agent<br />orchestration
          </h1>

          <p style={{
            fontSize: 15,
            color: "#64748B",
            lineHeight: 1.7,
            marginBottom: 36,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 400,
          }}>
            Deploy coordinated meshes of specialist agents across Finance, Legal,<br />
            Healthcare, Enterprise, and GCC Wealth domains.
          </p>

          {/* Domain badges */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
            {["💹 Finance", "⚖️ Legal", "🏥 Healthcare", "🏢 Enterprise", "🏦 GCC Wealth"].map(d => (
              <span key={d} style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 999,
                background: "#EEF2FF",
                color: "#4F46E5",
                fontFamily: "'DM Mono', monospace",
                border: "1px solid #C7D2FE",
              }}>{d}</span>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginBottom: 44 }}>
            {[
              { n: "14", label: "Contexts" },
              { n: "112", label: "Agents" },
              { n: "50", label: "Max per task" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, color: "#4F46E5" }}>{s.n}</div>
                <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <a
            href={getLoginUrl()}
            style={{
              display: "inline-block",
              background: "#4F46E5",
              color: "#fff",
              borderRadius: 10,
              padding: "14px 36px",
              fontSize: 14,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            Sign in to access the Mesh →
          </a>

          <p style={{ marginTop: 14, fontSize: 10, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>
            Sign in with Google, GitHub, or email · Free to use
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "16px 32px",
        borderTop: "1px solid #E2E8F0",
        fontSize: 10,
        color: "#CBD5E1",
        fontFamily: "'DM Mono', monospace",
      }}>
        AgenThink Mesh v3.1 · Institutional AI orchestration
      </footer>
    </div>
  );
}
