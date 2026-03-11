import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";

const NAVY_950 = "#080F1E";
const NAVY_900 = "#0C1628";
const NAVY_800 = "#111E35";
const NAVY_700 = "#162440";
const STEEL = "#1E2D47";
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const SILVER_50 = "#F0F4FA";
const SILVER_200 = "#C8D4E8";
const SILVER_400 = "#8494AA";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const STATUS_COLORS: Record<string, string> = {
  complete: "#4ADE80",
  analyzing: GOLD,
  pending: SILVER_400,
  error: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  complete: "Complete",
  analyzing: "Analysing",
  pending: "Pending",
  error: "Error",
};

export default function PortfolioVault() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: reviews, isLoading } = trpc.portfolio.list.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 10_000,
  });

  if (!isAuthenticated) {
    window.location.href = getLoginUrl("/vault");
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_50, display: "flex", flexDirection: "column" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", right: "10%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}06 0%, transparent 65%)`, filter: "blur(80px)" }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 40px",
        borderBottom: `1px solid ${STEEL}`,
        background: `${NAVY_900}F0`,
        backdropFilter: "blur(16px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/portfolio" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            Portfolio Intelligence
          </a>
          <a href="/ask" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            Mesh
          </a>
          <button
            onClick={() => navigate("/portfolio-review/upload")}
            style={{
              padding: "7px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${GOLD}25, ${GOLD}15)`,
              border: `1px solid ${GOLD}40`,
              color: SILVER_50, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: FONT,
            }}
          >
            + New Review
          </button>
        </div>
      </nav>

      {/* Main */}
      <main style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "52px 40px 80px", boxSizing: "border-box" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD, letterSpacing: "0.08em", marginBottom: 10 }}>PORTFOLIO INTELLIGENCE</div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, color: SILVER_50, marginBottom: 8, lineHeight: 1.15 }}>
            Review Vault
          </h1>
          <p style={{ fontSize: 14, color: SILVER_400, lineHeight: 1.65 }}>
            All your portfolio reviews — searchable, re-runnable, and ready for IC presentation.
          </p>
        </div>

        {/* Reviews list */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${STEEL}`, borderTopColor: GOLD, animation: "vaultSpin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 12, color: SILVER_400, fontFamily: MONO }}>Loading vault…</div>
          </div>
        ) : !reviews || reviews.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "80px 40px",
            background: NAVY_800,
            border: `1px solid ${STEEL}`,
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: SILVER_200, marginBottom: 8 }}>No reviews yet</div>
            <p style={{ fontSize: 13, color: SILVER_600, marginBottom: 24 }}>
              Upload your first fund documents to generate an institutional portfolio review.
            </p>
            <button
              onClick={() => navigate("/portfolio-review/upload")}
              style={{
                padding: "10px 24px", borderRadius: 10,
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                border: "none", color: NAVY_950,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: MONO, letterSpacing: "0.04em",
              }}
            >
              Start First Review →
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map(review => {
              const report = (() => {
                try { return JSON.parse(review.reportJson ?? "{}"); } catch { return {}; }
              })();
              const docs: unknown[] = (() => {
                try { return JSON.parse(review.documents ?? "[]"); } catch { return []; }
              })();
              const statusColor = STATUS_COLORS[review.status] ?? SILVER_400;
              const isComplete = review.status === "complete";

              return (
                <div
                  key={review.id}
                  onClick={() => isComplete && navigate(`/portfolio-review/report/${review.id}`)}
                  style={{
                    background: NAVY_800,
                    border: `1px solid ${STEEL}`,
                    borderRadius: 14,
                    padding: "20px 24px",
                    cursor: isComplete ? "pointer" : "default",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                  }}
                  onMouseEnter={e => { if (isComplete) { (e.currentTarget as HTMLDivElement).style.borderColor = GOLD + "40"; (e.currentTarget as HTMLDivElement).style.background = NAVY_700; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = STEEL; (e.currentTarget as HTMLDivElement).style.background = NAVY_800; }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${GOLD}12`, border: `1px solid ${GOLD}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, flexShrink: 0,
                  }}>📋</div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: SILVER_50, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {review.fundName ?? "Untitled Review"}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {review.manager && (
                        <span style={{ fontSize: 12, color: SILVER_400 }}>{review.manager}</span>
                      )}
                      {review.reviewPeriod && (
                        <span style={{ fontSize: 12, color: SILVER_600, fontFamily: MONO }}>{review.reviewPeriod}</span>
                      )}
                      <span style={{ fontSize: 12, color: SILVER_600, fontFamily: MONO }}>
                        {docs.length} doc{docs.length !== 1 ? "s" : ""}
                      </span>
                      <span style={{ fontSize: 12, color: SILVER_600, fontFamily: MONO }}>
                        {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Verdicts (only if complete) */}
                    {isComplete && report.mandateAlignment && (
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                        {([
                          { label: report.mandateAlignment as string, colors: { "Aligned": "#4ADE80", "Partial Deviation": GOLD, "Significant Deviation": "#EF4444" } as Record<string, string> },
                          { label: report.overallRiskRating as string, colors: { "Low": "#4ADE80", "Medium": GOLD, "High": "#EF4444" } as Record<string, string> },
                        ] as { label: string; colors: Record<string, string> }[]).map((v, i) => {
                          const c = v.colors[v.label] ?? SILVER_400;
                        return (
                          <span key={i} style={{
                            padding: "3px 10px", borderRadius: 20,
                            fontSize: 11, fontFamily: MONO, fontWeight: 700,
                            color: c, background: `${c}15`, border: `1px solid ${c}30`,
                          }}>{v.label}</span>
                        );
                      })}
                    </div>
                  )}

                  {/* Status badge */}
                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      padding: "4px 12px", borderRadius: 20,
                      fontSize: 11, fontFamily: MONO, fontWeight: 700,
                      color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}30`,
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      {review.status === "analyzing" && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, animation: "vaultPulse 1.2s ease-in-out infinite", display: "inline-block" }} />
                      )}
                      {STATUS_LABELS[review.status] ?? review.status}
                    </span>
                  </div>

                  {isComplete && (
                    <div style={{ color: SILVER_600, fontSize: 16, flexShrink: 0 }}>→</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style>{`
        @keyframes vaultSpin { to { transform: rotate(360deg); } }
        @keyframes vaultPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
