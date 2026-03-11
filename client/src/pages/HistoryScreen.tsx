import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";

const NAVY_950 = "#0B1629";
const NAVY_900 = "#0F1E38";
const NAVY_800 = "#152340";
const NAVY_700 = "#1A2D50";
const CYAN = "#00D4FF";
const BLUE = "#0080FF";
const SKY = "#40B8FF";
const INDIGO = "#4060FF";
const WHITE = "#F0F4FA";
const MUTED = "#8BA3C4";
const NEON_COLORS = [CYAN, BLUE, SKY, INDIGO, "#A040FF"];

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 80 ? CYAN : score >= 60 ? SKY : "#FFB040";
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 100,
      background: `${color}15`, border: `1px solid ${color}30`,
      color, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
      fontWeight: 600,
    }}>{score}%</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "complete" ? CYAN : status === "running" ? SKY : "#FF8080";
  const label = status === "complete" ? "✓ Done" : status === "running" ? "⟳ Running" : "✗ Failed";
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 100,
      background: `${color}12`, border: `1px solid ${color}25`,
      color, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
    }}>{label}</span>
  );
}

export default function HistoryScreen() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: tasks, isLoading } = trpc.mesh.listTasks.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${NAVY_950}, ${NAVY_900})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: WHITE, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Sign in to view your history</div>
          <div style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Your past queries and results are saved to your account.</div>
          <a href={getLoginUrl()} style={{
            padding: "12px 28px", borderRadius: 10,
            background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
            color: NAVY_950, fontWeight: 700, fontSize: 15, textDecoration: "none",
          }}>Sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${NAVY_950} 0%, ${NAVY_900} 60%, ${NAVY_800} 100%)`,
      fontFamily: "'Inter', sans-serif",
      overflowX: "hidden",
    }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "20%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${INDIGO}10 0%, transparent 70%)`, filter: "blur(60px)" }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: `1px solid ${CYAN}20`,
        background: `${NAVY_950}CC`,
        backdropFilter: "blur(12px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => navigate("/ask")} style={{
            padding: "7px 18px", borderRadius: 8,
            background: `linear-gradient(135deg, ${CYAN}30, ${BLUE}30)`,
            border: `1px solid ${CYAN}40`,
            color: CYAN, cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}>⚡ New Query</button>
          <button onClick={() => navigate("/mesh")} style={{
            padding: "7px 18px", borderRadius: 8, border: `1px solid ${CYAN}20`,
            background: "transparent", color: MUTED, cursor: "pointer", fontSize: 14,
          }}>Advanced</button>
        </div>
      </nav>

      {/* Content */}
      <main style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: WHITE, fontSize: 28, fontWeight: 800, margin: "0 0 6px", fontFamily: "'Playfair Display', serif" }}>
            Query History
          </h1>
          <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>
            All your past mesh queries and their results
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "60px 0" }}>
            {NEON_COLORS.map((c, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%", background: c,
                boxShadow: `0 0 10px ${c}`,
                animation: "bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!tasks || tasks.length === 0) && (
          <div style={{
            textAlign: "center", padding: "80px 24px",
            background: `${NAVY_800}80`,
            border: `1px solid ${CYAN}15`,
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
            <div style={{ color: WHITE, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No queries yet</div>
            <div style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Submit your first task to see results here.</div>
            <button onClick={() => navigate("/ask")} style={{
              padding: "12px 28px", borderRadius: 10,
              background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
              border: "none", color: NAVY_950, fontWeight: 700, fontSize: 15,
              cursor: "pointer",
            }}>⚡ Start a Query</button>
          </div>
        )}

        {/* Task list */}
        {!isLoading && tasks && tasks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tasks.map((task, i) => {
              const accentColor = NEON_COLORS[i % NEON_COLORS.length];
              return (
                <div
                  key={task.id}
                  onClick={() => task.status === "complete" && navigate(`/result/${task.id}`)}
                  style={{
                    background: `${NAVY_800}CC`,
                    border: `1px solid ${accentColor}20`,
                    borderLeft: `3px solid ${accentColor}`,
                    borderRadius: 12,
                    padding: "18px 24px",
                    cursor: task.status === "complete" ? "pointer" : "default",
                    transition: "all 0.2s",
                    backdropFilter: "blur(8px)",
                  }}
                  onMouseEnter={e => {
                    if (task.status === "complete") {
                      e.currentTarget.style.borderColor = `${accentColor}50`;
                      e.currentTarget.style.background = `${NAVY_700}CC`;
                      e.currentTarget.style.transform = "translateX(4px)";
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${accentColor}20`;
                    e.currentTarget.style.background = `${NAVY_800}CC`;
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <p style={{ color: WHITE, fontSize: 15, margin: "0 0 8px", lineHeight: 1.5, fontWeight: 500 }}>
                        {task.query}
                      </p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {task.taskType && (
                          <span style={{
                            padding: "2px 10px", borderRadius: 100,
                            background: `${accentColor}12`, border: `1px solid ${accentColor}25`,
                            color: accentColor, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                          }}>{task.taskType}</span>
                        )}
                        <StatusBadge status={task.status} />
                        <ConfidenceBadge score={task.confidenceScore} />
                        {task.executionTimeMs && (
                          <span style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                            {(task.executionTimeMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{ color: MUTED, fontSize: 12 }}>
                        {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {task.status === "complete" && (
                        <span style={{ color: accentColor, fontSize: 13, fontWeight: 600 }}>View result →</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      `}</style>
    </div>
  );
}
