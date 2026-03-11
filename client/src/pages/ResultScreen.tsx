import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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

function ConfidenceRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 80 ? CYAN : score >= 60 ? SKY : "#FFB040";
  return (
    <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
      <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={48} cy={48} r={radius} fill="none" stroke={`${color}20`} strokeWidth={8} />
        <circle cx={48} cy={48} r={radius} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color, fontSize: 20, fontWeight: 800 }}>{score}%</span>
        <span style={{ color: MUTED, fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>CONFIDENCE</span>
      </div>
    </div>
  );
}

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return (
    <div>
      <div style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 8 }}>SENTIMENT DISTRIBUTION</div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 10, gap: 2 }}>
        <div style={{ flex: positive, background: CYAN, boxShadow: `0 0 6px ${CYAN}60` }} />
        <div style={{ flex: neutral, background: NAVY_700 }} />
        <div style={{ flex: negative, background: "#FF6060", boxShadow: "0 0 6px #FF606060" }} />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
        <span style={{ color: CYAN, fontSize: 11 }}>● Positive {positive}%</span>
        <span style={{ color: MUTED, fontSize: 11 }}>● Neutral {neutral}%</span>
        <span style={{ color: "#FF8080", fontSize: 11 }}>● Negative {negative}%</span>
      </div>
    </div>
  );
}

export default function ResultScreen() {
  const params = useParams<{ id: string }>();
  const taskId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();

  const { data: task, isLoading, error } = trpc.mesh.getTask.useQuery(
    { id: taskId },
    { enabled: !!taskId, refetchInterval: (query) => (query.state.data as { status?: string } | undefined)?.status === "running" ? 2000 : false }
  );

  if (isLoading || task?.status === "running") {
    return (
      <div style={{
        minHeight: "100vh", background: `linear-gradient(160deg, ${NAVY_950}, ${NAVY_900})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
            {NEON_COLORS.map((c, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%", background: c,
                boxShadow: `0 0 10px ${c}`,
                animation: "bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>
          <div style={{ color: WHITE, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Mesh is working…</div>
          <div style={{ color: MUTED, fontSize: 13 }}>5 specialist agents are analysing your query</div>
        </div>
        <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div style={{
        minHeight: "100vh", background: `linear-gradient(160deg, ${NAVY_950}, ${NAVY_900})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ color: "#FF8080", fontSize: 16, marginBottom: 16 }}>⚠ Task not found or error occurred</div>
        <button onClick={() => navigate("/ask")} style={{
          padding: "10px 24px", borderRadius: 8, border: `1px solid ${CYAN}40`,
          background: "transparent", color: CYAN, cursor: "pointer", fontSize: 14,
        }}>← Back to Ask</button>
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
        <div style={{ position: "absolute", top: "5%", right: "10%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${CYAN}10 0%, transparent 70%)`, filter: "blur(60px)" }} />
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
            padding: "7px 18px", borderRadius: 8, border: `1px solid ${CYAN}30`,
            background: "transparent", color: CYAN, cursor: "pointer", fontSize: 14,
          }}>← New Query</button>
          <button onClick={() => navigate("/history")} style={{
            padding: "7px 18px", borderRadius: 8, border: `1px solid ${CYAN}20`,
            background: "transparent", color: MUTED, cursor: "pointer", fontSize: 14,
          }}>History</button>
        </div>
      </nav>

      {/* Content */}
      <main style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header card */}
        <div style={{
          background: `${NAVY_800}CC`,
          border: `1px solid ${CYAN}30`,
          borderRadius: 16,
          padding: "28px 32px",
          marginBottom: 20,
          backdropFilter: "blur(12px)",
          boxShadow: `0 0 40px ${CYAN}08`,
        }}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <ConfidenceRing score={task.confidenceScore ?? 0} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{
                  padding: "3px 12px", borderRadius: 100,
                  background: `${CYAN}15`, border: `1px solid ${CYAN}30`,
                  color: CYAN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                }}>{task.taskType ?? "Analysis"}</span>
                <span style={{
                  padding: "3px 12px", borderRadius: 100,
                  background: `${BLUE}15`, border: `1px solid ${BLUE}30`,
                  color: SKY, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                }}>{task.agentsUsed ?? 5} agents</span>
                <span style={{
                  padding: "3px 12px", borderRadius: 100,
                  background: `${NAVY_700}`, border: `1px solid ${NAVY_700}`,
                  color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                }}>{task.executionTimeMs ? `${(task.executionTimeMs / 1000).toFixed(1)}s` : "—"}</span>
              </div>
              <p style={{ color: WHITE, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                <span style={{ color: MUTED, fontSize: 12, display: "block", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>QUERY</span>
                {task.query}
              </p>
            </div>
          </div>
        </div>

        {/* Two-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginBottom: 16 }}>

          {/* Key Findings */}
          <div style={{
            background: `${NAVY_800}CC`, border: `1px solid ${CYAN}25`,
            borderRadius: 14, padding: "22px 24px",
          }}>
            <div style={{ color: CYAN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>KEY FINDINGS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(task.keyFindings ?? []).map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: NEON_COLORS[i % NEON_COLORS.length], fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ color: WHITE, fontSize: 14, lineHeight: 1.55 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          <div style={{
            background: `${NAVY_800}CC`, border: `1px solid #FF404025`,
            borderRadius: 14, padding: "22px 24px",
          }}>
            <div style={{ color: "#FF8080", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>RISK FACTORS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {(task.risks ?? []).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#FF8080", fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
                  <span style={{ color: WHITE, fontSize: 14, lineHeight: 1.55 }}>{r}</span>
                </div>
              ))}
            </div>
            <SentimentBar
              positive={task.sentimentPositive ?? 0}
              neutral={task.sentimentNeutral ?? 0}
              negative={task.sentimentNegative ?? 0}
            />
          </div>
        </div>

        {/* Segment Insights */}
        <div style={{
          background: `${NAVY_800}CC`, border: `1px solid ${BLUE}25`,
          borderRadius: 14, padding: "22px 24px",
          marginBottom: 16,
        }}>
          <div style={{ color: SKY, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>SEGMENT INSIGHTS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {(task.segmentInsights ?? []).map((seg, i) => {
              const color = NEON_COLORS[i % NEON_COLORS.length];
              return (
                <div key={i} style={{
                  background: `${NAVY_700}80`,
                  border: `1px solid ${color}25`,
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div style={{ color: WHITE, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{seg.segment}</div>
                  <div style={{ height: 4, borderRadius: 2, background: `${NAVY_950}`, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{
                      height: "100%", width: `${seg.likelihood}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}80)`,
                      boxShadow: `0 0 6px ${color}60`,
                      borderRadius: 2,
                    }} />
                  </div>
                  <div style={{ color: color, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{seg.likelihood}% likelihood</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendation */}
        {task.recommendation && (
          <div style={{
            background: `linear-gradient(135deg, ${CYAN}08, ${BLUE}08)`,
            border: `1px solid ${CYAN}30`,
            borderRadius: 14, padding: "22px 24px",
            marginBottom: 16,
          }}>
            <div style={{ color: CYAN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 10 }}>RECOMMENDATION</div>
            <p style={{ color: WHITE, fontSize: 15, lineHeight: 1.7, margin: 0 }}>{task.recommendation}</p>
          </div>
        )}

        {/* Mesh Route Transparency */}
        {(task.meshRoute ?? []).length > 0 && (
          <div style={{
            background: `${NAVY_800}80`,
            border: `1px solid ${NAVY_700}`,
            borderRadius: 14, padding: "18px 24px",
            marginBottom: 32,
          }}>
            <div style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 12 }}>HOW THE MESH ROUTED YOUR TASK</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(task.meshRoute ?? []).map((agent, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    padding: "4px 12px", borderRadius: 100,
                    background: `${NEON_COLORS[i % NEON_COLORS.length]}15`,
                    border: `1px solid ${NEON_COLORS[i % NEON_COLORS.length]}30`,
                    color: NEON_COLORS[i % NEON_COLORS.length],
                    fontSize: 12,
                  }}>{agent}</span>
                  {i < (task.meshRoute ?? []).length - 1 && (
                    <span style={{ color: MUTED, fontSize: 14 }}>→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/ask")} style={{
            padding: "12px 28px", borderRadius: 10,
            background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
            border: "none", color: NAVY_950, fontWeight: 700, fontSize: 15,
            cursor: "pointer",
          }}>⚡ New Query</button>
          <button onClick={() => navigate("/history")} style={{
            padding: "12px 28px", borderRadius: 10,
            background: "transparent", border: `1px solid ${CYAN}30`,
            color: CYAN, fontSize: 15, cursor: "pointer",
          }}>View History</button>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
      `}</style>
    </div>
  );
}
