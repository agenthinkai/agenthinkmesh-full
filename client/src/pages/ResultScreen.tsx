import { useParams, useLocation } from "wouter";
import React from "react";
import { trpc } from "@/lib/trpc";
import Logo from "@/components/Logo";

const NAVY_950 = "#0B1629";
const NAVY_900 = "#0F1E38";
const NAVY_800 = "#152340";
const NAVY_700 = "#1A2D50";
const CYAN = "#00D4FF";
const BLUE = "#0080FF";
const SKY = "#40B8FF";
const GREEN = "#4ADE80";
const AMBER = "#F59E0B";
const WHITE = "#F0F4FA";
const MUTED = "#8BA3C4";
const NEON_COLORS = [CYAN, BLUE, SKY, "#A78BFA", GREEN];

// ── Type definitions for structured report ────────────────────────────────────
interface FinancialTableRow {
  label: string;
  values: (string | number)[];
  isHeader?: boolean;
  isBold?: boolean;
}
interface FinancialTable {
  years: string[];
  rows: FinancialTableRow[];
}
interface DCFValuation {
  wacc: string;
  terminalGrowthRate: string;
  impliedValuation: string;
  valuationRange: string;
  assumptions: string[];
  sensitivityNote: string;
}
interface KeyMetric {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
}
interface RevenueSegment {
  segment: string;
  value: string;
  percentage?: string;
}
interface StructuredReport {
  executiveSummary?: string;
  senseCheck?: { verdict: string; observations: string[] };
  balanceSheet?: FinancialTable | null;
  cashFlowStatement?: FinancialTable | null;
  dcfValuation?: DCFValuation | null;
  keyMetrics?: KeyMetric[];
  revenueSegments?: RevenueSegment[] | null;
  nextSteps?: string[];
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ConfidenceRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color = score >= 80 ? CYAN : score >= 60 ? SKY : AMBER;
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
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
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

function SectionCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `${NAVY_800}CC`, border: `1px solid ${color}25`,
      borderRadius: 14, padding: "22px 24px", marginBottom: 16,
    }}>
      <div style={{ color, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function FinancialTableView({ table, title, color }: { table: FinancialTable; title: string; color: string }) {
  return (
    <SectionCard title={title} color={color}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", color: MUTED, fontWeight: 600, borderBottom: `1px solid ${NAVY_700}`, minWidth: 180 }}>Particulars</th>
              {(table.years ?? []).map((y, i) => (
                <th key={i} style={{ textAlign: "right", padding: "6px 10px", color: color, fontWeight: 600, borderBottom: `1px solid ${NAVY_700}`, whiteSpace: "nowrap" }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(table.rows ?? []).map((row, i) => (
              <tr key={i} style={{ background: row.isHeader ? `${NAVY_700}60` : "transparent" }}>
                <td style={{
                  padding: "5px 10px", color: row.isHeader ? color : row.isBold ? WHITE : MUTED,
                  fontWeight: row.isHeader || row.isBold ? 700 : 400,
                  borderBottom: `1px solid ${NAVY_700}30`,
                  paddingLeft: row.isHeader ? 10 : 20,
                  fontSize: row.isHeader ? 12 : 13,
                }}>{row.label}</td>
                    {(row.values ?? []).map((v, j) => (
                  <td key={j} style={{
                    textAlign: "right", padding: "5px 10px",
                    color: row.isBold ? WHITE : typeof v === "number" && v < 0 ? "#FF8080" : WHITE,
                    fontWeight: row.isBold ? 700 : 400,
                    borderBottom: `1px solid ${NAVY_700}30`,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  }}>
                    {typeof v === "number" ? v.toLocaleString() : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function DCFSection({ dcf }: { dcf: DCFValuation }) {
  return (
    <SectionCard title="DCF VALUATION" color={AMBER}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "WACC", value: dcf.wacc },
          { label: "Terminal Growth Rate", value: dcf.terminalGrowthRate },
          { label: "Implied Valuation", value: dcf.impliedValuation },
          { label: "Valuation Range", value: dcf.valuationRange },
        ].map((item, i) => (
          <div key={i} style={{ background: `${NAVY_700}80`, border: `1px solid ${AMBER}20`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ color: MUTED, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label.toUpperCase()}</div>
            <div style={{ color: AMBER, fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
          </div>
        ))}
      </div>
      {(dcf.assumptions ?? []).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", marginBottom: 8 }}>KEY ASSUMPTIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(dcf.assumptions ?? []).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: AMBER, fontSize: 12, flexShrink: 0, marginTop: 2 }}>◆</span>
                <span style={{ color: WHITE, fontSize: 13, lineHeight: 1.5 }}>{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {dcf.sensitivityNote && (
        <div style={{ background: `${AMBER}08`, border: `1px solid ${AMBER}20`, borderRadius: 8, padding: "10px 14px" }}>
          <span style={{ color: AMBER, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>SENSITIVITY: </span>
          <span style={{ color: MUTED, fontSize: 13 }}>{dcf.sensitivityNote}</span>
        </div>
      )}
    </SectionCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ResultScreen() {
  const params = useParams<{ id: string }>();
  const taskId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const [pdfLoading, setPdfLoading] = React.useState(false);

  const downloadPdf = trpc.mesh.downloadPdf.useMutation({
    onSuccess: (data) => {
      // Decode base64 and trigger browser download
      const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setPdfLoading(false);
    },
    onError: () => setPdfLoading(false),
  });

  const handleDownloadPdf = () => {
    if (!taskId || pdfLoading) return;
    setPdfLoading(true);
    downloadPdf.mutate({ id: taskId });
  };

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
          <div style={{ color: MUTED, fontSize: 13 }}>Specialist agents are analysing your query</div>
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

  const report = task.structuredReport as StructuredReport | null;

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
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            style={{
              padding: "7px 18px", borderRadius: 8,
              border: `1px solid ${GREEN}40`,
              background: pdfLoading ? `${GREEN}10` : `${GREEN}18`,
              color: pdfLoading ? MUTED : GREEN,
              cursor: pdfLoading ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.2s",
            }}
          >
            {pdfLoading ? (
              <><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${GREEN}40`, borderTopColor: GREEN, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Generating…</>
            ) : (
              <>⬇ Download PDF</>
            )}
          </button>
        </div>
      </nav>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Content */}
      <main style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header card */}
        <div style={{
          background: `${NAVY_800}CC`, border: `1px solid ${CYAN}30`, borderRadius: 16,
          padding: "28px 32px", marginBottom: 20, backdropFilter: "blur(12px)",
          boxShadow: `0 0 40px ${CYAN}08`,
        }}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <ConfidenceRing score={task.confidenceScore ?? 0} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ padding: "3px 12px", borderRadius: 100, background: `${CYAN}15`, border: `1px solid ${CYAN}30`, color: CYAN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{task.taskType ?? "Analysis"}</span>
                <span style={{ padding: "3px 12px", borderRadius: 100, background: `${BLUE}15`, border: `1px solid ${BLUE}30`, color: SKY, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{task.agentsUsed ?? 5} agents</span>
                <span style={{ padding: "3px 12px", borderRadius: 100, background: NAVY_700, border: `1px solid ${NAVY_700}`, color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{task.executionTimeMs ? `${(task.executionTimeMs / 1000).toFixed(1)}s` : "—"}</span>
                {task.fileName && (
                  <span style={{ padding: "3px 12px", borderRadius: 100, background: `${GREEN}15`, border: `1px solid ${GREEN}30`, color: GREEN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                    📎 {task.fileName}
                  </span>
                )}
              </div>
              <p style={{ color: WHITE, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                <span style={{ color: MUTED, fontSize: 12, display: "block", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>QUERY</span>
                {task.query}
              </p>
            </div>
          </div>
        </div>

        {/* ── Structured Report Sections (when available) ── */}
        {report && (
          <>
            {/* Executive Summary */}
            {report.executiveSummary && (
              <SectionCard title="EXECUTIVE SUMMARY" color={CYAN}>
                <p style={{ color: WHITE, fontSize: 15, lineHeight: 1.75, margin: 0 }}>{report.executiveSummary}</p>
              </SectionCard>
            )}

            {/* Sense Check */}
            {report.senseCheck && (
              <SectionCard title="SENSE CHECK" color={report.senseCheck.verdict === "Credible" ? GREEN : report.senseCheck.verdict === "Unreliable" ? "#FF8080" : AMBER}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{
                    padding: "5px 16px", borderRadius: 100,
                    background: report.senseCheck.verdict === "Credible" ? `${GREEN}20` : report.senseCheck.verdict === "Unreliable" ? "#FF808020" : `${AMBER}20`,
                    border: `1px solid ${report.senseCheck.verdict === "Credible" ? GREEN : report.senseCheck.verdict === "Unreliable" ? "#FF8080" : AMBER}40`,
                    color: report.senseCheck.verdict === "Credible" ? GREEN : report.senseCheck.verdict === "Unreliable" ? "#FF8080" : AMBER,
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {report.senseCheck.verdict === "Credible" ? "✓" : report.senseCheck.verdict === "Unreliable" ? "✗" : "⚠"} {report.senseCheck.verdict}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(report.senseCheck.observations ?? []).map((obs, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: MUTED, fontSize: 14, flexShrink: 0, marginTop: 1 }}>·</span>
                      <span style={{ color: WHITE, fontSize: 14, lineHeight: 1.55 }}>{obs}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Key Metrics */}
            {report.keyMetrics && report.keyMetrics.length > 0 && (
              <SectionCard title="KEY METRICS" color={SKY}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                  {(report.keyMetrics ?? []).map((m, i) => (
                    <div key={i} style={{ background: `${NAVY_700}80`, border: `1px solid ${SKY}15`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ color: MUTED, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", marginBottom: 4 }}>{m.label.toUpperCase()}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: WHITE, fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</span>
                        <span style={{ fontSize: 14 }}>{m.trend === "up" ? "↑" : m.trend === "down" ? "↓" : "→"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Revenue Segment Breakdown */}
            {report.revenueSegments && report.revenueSegments.length > 0 && (
              <SectionCard title="REVENUE SEGMENT BREAKDOWN" color={GREEN}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {(report.revenueSegments ?? []).map((seg, i) => {
                    const color = NEON_COLORS[i % NEON_COLORS.length];
                    return (
                      <div key={i} style={{ background: `${NAVY_700}80`, border: `1px solid ${color}25`, borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ color: WHITE, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{seg.segment}</div>
                        <div style={{ color, fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{seg.value}</div>
                        {seg.percentage && (
                          <div style={{ color: MUTED, fontSize: 12 }}>{seg.percentage} of total</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Balance Sheet */}
            {report.balanceSheet && (
              <FinancialTableView table={report.balanceSheet} title="DERIVED BALANCE SHEET" color={BLUE} />
            )}

            {/* Cash Flow Statement */}
            {report.cashFlowStatement && (
              <FinancialTableView table={report.cashFlowStatement} title="STATEMENT OF CASH FLOWS" color="#A78BFA" />
            )}

            {/* DCF Valuation */}
            {report.dcfValuation && (
              <DCFSection dcf={report.dcfValuation} />
            )}
          </>
        )}

        {/* ── Standard sections (always shown) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16, marginBottom: 16 }}>
          {/* Key Findings */}
          <div style={{ background: `${NAVY_800}CC`, border: `1px solid ${CYAN}25`, borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ color: CYAN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>KEY FINDINGS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(task.keyFindings ?? []).map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: NEON_COLORS[i % NEON_COLORS.length], fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ color: WHITE, fontSize: 14, lineHeight: 1.55 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          <div style={{ background: `${NAVY_800}CC`, border: `1px solid #FF404025`, borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ color: "#FF8080", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>RISK FACTORS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {(task.risks ?? []).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#FF8080", fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
                  <span style={{ color: WHITE, fontSize: 14, lineHeight: 1.55 }}>{r}</span>
                </div>
              ))}
            </div>
            <SentimentBar positive={task.sentimentPositive ?? 0} neutral={task.sentimentNeutral ?? 0} negative={task.sentimentNegative ?? 0} />
          </div>
        </div>

        {/* Segment Insights — only shown for non-financial tasks (hidden when structured report is present) */}
        {!report && (task.segmentInsights ?? []).length > 0 && (
          <div style={{ background: `${NAVY_800}CC`, border: `1px solid ${BLUE}25`, borderRadius: 14, padding: "22px 24px", marginBottom: 16 }}>
            <div style={{ color: SKY, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>SEGMENT INSIGHTS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {(task.segmentInsights ?? []).map((seg, i) => {
                const color = NEON_COLORS[i % NEON_COLORS.length];
                return (
                  <div key={i} style={{ background: `${NAVY_700}80`, border: `1px solid ${color}25`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ color: WHITE, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{seg.segment}</div>
                    <div style={{ height: 4, borderRadius: 2, background: NAVY_950, overflow: "hidden", marginBottom: 4 }}>
                      <div style={{ height: "100%", width: `${seg.likelihood}%`, background: `linear-gradient(90deg, ${color}, ${color}80)`, boxShadow: `0 0 6px ${color}60`, borderRadius: 2 }} />
                    </div>
                    <div style={{ color, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{seg.likelihood}% likelihood</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {task.recommendation && (
          <div style={{ background: `linear-gradient(135deg, ${CYAN}08, ${BLUE}08)`, border: `1px solid ${CYAN}30`, borderRadius: 14, padding: "22px 24px", marginBottom: 16 }}>
            <div style={{ color: CYAN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 10 }}>RECOMMENDATION</div>
            <p style={{ color: WHITE, fontSize: 15, lineHeight: 1.7, margin: 0 }}>{task.recommendation}</p>
          </div>
        )}

        {/* Next Steps (from structured report) */}
        {report?.nextSteps && report.nextSteps.length > 0 && (
          <SectionCard title="SUGGESTED NEXT STEPS" color={GREEN}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(report.nextSteps ?? []).map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ background: `${GREEN}20`, border: `1px solid ${GREEN}40`, color: GREEN, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  <span style={{ color: WHITE, fontSize: 14, lineHeight: 1.6 }}>{step}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Mesh Route Transparency */}
        {(task.meshRoute ?? []).length > 0 && (
          <div style={{ background: `${NAVY_800}80`, border: `1px solid ${NAVY_700}`, borderRadius: 14, padding: "18px 24px", marginBottom: 16 }}>
            <div style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 12 }}>HOW THE MESH ROUTED YOUR TASK</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(task.meshRoute ?? []).map((agent, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ padding: "4px 12px", borderRadius: 100, background: `${NEON_COLORS[i % NEON_COLORS.length]}15`, border: `1px solid ${NEON_COLORS[i % NEON_COLORS.length]}30`, color: NEON_COLORS[i % NEON_COLORS.length], fontSize: 12 }}>{agent}</span>
                  {i < (task.meshRoute ?? []).length - 1 && <span style={{ color: MUTED, fontSize: 14 }}>→</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ background: `linear-gradient(135deg, ${NAVY_800}80, ${NAVY_700}40)`, border: `1px solid ${CYAN}20`, borderRadius: 16, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
          <div style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>WHAT WOULD YOU LIKE TO DO NEXT?</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => { const query = encodeURIComponent(task?.query ?? ""); navigate(`/ask?refine=${query}`); }}
              style={{ padding: "14px 32px", borderRadius: 10, background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`, border: "none", color: NAVY_950, fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 24px ${CYAN}40`, transition: "transform 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 32px ${CYAN}60`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 24px ${CYAN}40`; }}
            >⚡ New Analysis</button>
            <button onClick={() => navigate("/ask")} style={{ padding: "14px 28px", borderRadius: 10, background: "transparent", border: `1px solid ${SKY}40`, color: SKY, fontSize: 15, cursor: "pointer" }}>+ Start Fresh</button>
            <button onClick={() => navigate("/history")} style={{ padding: "14px 28px", borderRadius: 10, background: "transparent", border: `1px solid ${MUTED}30`, color: MUTED, fontSize: 15, cursor: "pointer" }}>📋 View History</button>
          </div>
          <div style={{ color: MUTED, fontSize: 12 }}>
            <span style={{ color: CYAN }}>⚡ New Analysis</span> — refine this query with additional context &nbsp;·&nbsp; <span style={{ color: SKY }}>+ Start Fresh</span> — begin a completely new task
          </div>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
      `}</style>
    </div>
  );
}
