/**
 * PortfolioMesh — Public Shared Run View
 * Route: /portfolio-mesh/share/:token
 * - No authentication required
 * - Read-only, no pipeline execution
 * - Renders stored Board Memo from DB via shareToken
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function fmt(v: number | null | undefined, decimals = 2, suffix = "%") {
  if (v == null) return "—";
  return `${(v * 100).toFixed(decimals)}${suffix}`;
}
function fmtSharpe(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(2);
}
function confidenceLabel(c: number | null) {
  if (!c) return "—";
  if (c >= 0.75) return "High";
  if (c >= 0.5) return "Medium";
  return "Low";
}
function confidenceColor(c: number | null) {
  if (!c) return "#94a3b8";
  if (c >= 0.75) return "#4ade80";
  if (c >= 0.5) return "#fbbf24";
  return "#f87171";
}
function severityColor(s: string) {
  if (s === "High") return "#f87171";
  if (s === "Medium") return "#fbbf24";
  return "#4ade80";
}

/* ─── Section Card ────────────────────────────────────────────────────── */
function SectionCard({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#7ba3d4",
          background: "rgba(123,163,212,0.12)",
          borderRadius: 6, padding: "2px 8px",
          letterSpacing: "0.04em",
        }}>{num}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.01em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── Metric Pill ─────────────────────────────────────────────────────── */
function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${color}33`,
      borderRadius: 8,
      padding: "10px 16px",
      textAlign: "center",
      minWidth: 100,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{label}</div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────── */
export default function PortfolioMeshShare() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data: run, isLoading, error } = trpc.portfolioMesh.getRunByToken.useQuery(
    { token },
    { enabled: token.length >= 8, retry: false }
  );

  const bg = "#0b0f1a";
  const text = "#e2e8f0";

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#7ba3d4", fontSize: 14 }}>Loading shared portfolio…</div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ color: "#f87171", fontSize: 16, fontWeight: 600 }}>Share link not found</div>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>This link may have been revoked or does not exist.</div>
        <a href="/portfolio-mesh" style={{ color: "#7ba3d4", fontSize: 13, marginTop: 8 }}>← Open PortfolioMesh</a>
      </div>
    );
  }

  const memo = run.boardMemo as Record<string, unknown> | null;
  const ips = run.ipsSnapshot as { name?: string; returnTarget?: number; maxVolatility?: number; maxDrawdown?: number } | null;

  function exportTxt() {
    if (!memo) return;
    const lines: string[] = [
      "AGENTHINK — PORTFOLIOMESH BOARD MEMO (SHARED)",
      `Date: ${new Date(run!.createdAt).toLocaleDateString()}`,
      `IPS: ${ips?.name ?? "—"}`,
      "",
    ];
    const sections: [string, string][] = [
      ["Executive Summary", "executiveSummary"],
      ["Recommended Allocation", "recommendedAllocation"],
      ["Macro Regime View", "macroRegimeView"],
      ["Portfolio Construction Logic", "constructionLogic"],
      ["Benchmark Comparison", "benchmarkComparison"],
      ["Key Risks", "keyRisks"],
      ["What Would Change This View", "whatWouldChangeView"],
      ["IPS Compliance Statement", "ipsComplianceStatement"],
      ["Recommendation", "recommendation"],
    ];
    sections.forEach(([title, key]) => {
      const val = memo[key];
      if (!val) return;
      lines.push(`── ${title} ──`);
      if (Array.isArray(val)) val.forEach((v: unknown) => lines.push(`• ${v}`));
      else if (typeof val === "object") lines.push(JSON.stringify(val, null, 2));
      else lines.push(String(val));
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "AgenThinkMesh_BoardMemo_Shared.txt";
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "system-ui, sans-serif" }}>
      {/* Read-only banner */}
      <div style={{
        background: "rgba(251,191,36,0.1)",
        borderBottom: "1px solid rgba(251,191,36,0.25)",
        padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 600 }}>🔒 Shared Portfolio — Read Only</span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>This is a shared view. No editing or re-running is available.</span>
        </div>
        <a href="/portfolio-mesh" style={{ fontSize: 12, color: "#7ba3d4", textDecoration: "none" }}>
          Open PortfolioMesh →
        </a>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#7ba3d4" }}>🏦 PortfolioMesh</span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Board Memo</span>
            {run.isBenchmark && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#a78bfa",
                background: "rgba(167,139,250,0.12)",
                border: "1px solid rgba(167,139,250,0.25)",
                borderRadius: 6, padding: "2px 8px",
              }}>◉ Benchmark</span>
            )}
            {run.ipsCompliant && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#4ade80",
                background: "rgba(74,222,128,0.1)",
                border: "1px solid rgba(74,222,128,0.2)",
                borderRadius: 6, padding: "2px 8px",
              }}>✓ IPS Compliant</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            {ips?.name ?? "Portfolio Run"} · {new Date(run.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        {/* Portfolio Metrics */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <MetricPill label="Expected Return" value={fmt(run.cioExpectedReturn)} color="#4ade80" />
          <MetricPill label="Volatility" value={fmt(run.cioExpectedVolatility)} color="#f87171" />
          <MetricPill label="Sharpe Ratio" value={fmtSharpe(run.cioSharpe)} color="#7ba3d4" />
          {run.macroRegime && (
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "10px 16px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{run.macroRegime}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Macro Regime</div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: confidenceColor(run.macroConfidence),
                  background: `${confidenceColor(run.macroConfidence)}18`,
                  borderRadius: 4, padding: "1px 6px",
                }}>{confidenceLabel(run.macroConfidence)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Board Memo Sections */}
        {memo && (
          <>
            {/* 1. Executive Summary */}
            {Array.isArray(memo.executiveSummary) && memo.executiveSummary.length > 0 && (
              <SectionCard num="01" title="Executive Summary">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {(memo.executiveSummary as string[]).map((pt, i) => (
                    <li key={i} style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>{pt}</li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* 2. Recommended Allocation */}
            {Array.isArray((memo.recommendedAllocation as { allocationTable?: unknown[] })?.allocationTable) && (
              <SectionCard num="02" title="Recommended Allocation">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Asset Class", "Weight", "Strategic Role"].map(h => (
                        <th key={h} style={{ textAlign: "left", fontSize: 11, color: "#64748b", fontWeight: 600, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {((memo.recommendedAllocation as { allocationTable: { assetClass: string; weight: string; strategicRole: string }[] }).allocationTable).map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 13, color: "#e2e8f0", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row.assetClass}</td>
                        <td style={{ fontSize: 13, color: "#7ba3d4", fontWeight: 700, fontFamily: "monospace", padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row.weight}</td>
                        <td style={{ fontSize: 12, color: "#94a3b8", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row.strategicRole}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>
            )}

            {/* 3. Macro Regime View */}
            {memo.macroRegimeView && typeof memo.macroRegimeView === "object" && (
              <SectionCard num="03" title="Macro Regime View">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                    {(memo.macroRegimeView as { regime?: string }).regime}
                  </span>
                  {(memo.macroRegimeView as { confidence?: string }).confidence && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: (memo.macroRegimeView as { confidence?: string }).confidence === "High" ? "#4ade80" : (memo.macroRegimeView as { confidence?: string }).confidence === "Medium" ? "#fbbf24" : "#f87171",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 5, padding: "2px 8px",
                    }}>{(memo.macroRegimeView as { confidence?: string }).confidence}</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                  {(memo.macroRegimeView as { rationale?: string }).rationale}
                </p>
              </SectionCard>
            )}

            {/* 4. Portfolio Construction Logic */}
            {memo.constructionLogic && typeof memo.constructionLogic === "object" && (
              <SectionCard num="04" title="Portfolio Construction Logic">
                {(memo.constructionLogic as { methodsUsed?: string[] }).methodsUsed && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>METHODS USED</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(memo.constructionLogic as { methodsUsed: string[] }).methodsUsed.map((m, i) => (
                        <span key={i} style={{
                          fontSize: 11, color: "#7ba3d4",
                          background: "rgba(123,163,212,0.1)",
                          border: "1px solid rgba(123,163,212,0.2)",
                          borderRadius: 5, padding: "2px 8px",
                        }}>{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(memo.constructionLogic as { blendRationale?: string }).blendRationale && (
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                    {(memo.constructionLogic as { blendRationale: string }).blendRationale}
                  </p>
                )}
              </SectionCard>
            )}

            {/* 5. Benchmark Comparison */}
            {memo.benchmarkComparison && typeof memo.benchmarkComparison === "object" && (
              <SectionCard num="05" title="Benchmark Comparison">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {[
                    { label: "Equity", key: "equity" },
                    { label: "Bonds", key: "bonds" },
                    { label: "Alternatives", key: "alternatives" },
                    { label: "Cash", key: "cash" },
                  ].map(({ label, key }) => {
                    const val = (memo.benchmarkComparison as Record<string, string>)[key];
                    return (
                      <div key={key} style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8, padding: "10px 12px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", fontFamily: "monospace" }}>{val ?? "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* 6. Key Risks */}
            {Array.isArray((memo.keyRisks as { risks?: unknown[] })?.risks) && (
              <SectionCard num="06" title="Key Risks">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {((memo.keyRisks as { risks: { risk: string; severity: string; mitigation: string }[] }).risks).map((r, i) => (
                    <div key={i} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8, padding: "10px 14px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: severityColor(r.severity),
                          background: `${severityColor(r.severity)}18`,
                          borderRadius: 4, padding: "1px 6px",
                        }}>{r.severity}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{r.risk}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{r.mitigation}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* 7. What Would Change This View */}
            {Array.isArray(memo.whatWouldChangeView) && memo.whatWouldChangeView.length > 0 && (
              <SectionCard num="07" title="What Would Change This View">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {(memo.whatWouldChangeView as string[]).map((pt, i) => (
                    <li key={i} style={{ color: "#c4b5fd", fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>◈ {pt}</li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* 8. IPS Compliance Statement */}
            {memo.ipsComplianceStatement && typeof memo.ipsComplianceStatement === "object" && (
              <SectionCard num="08" title="IPS Compliance Statement">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "Return Target", key: "returnTargetMet" },
                    { label: "Volatility Limit", key: "volatilityLimitMet" },
                    { label: "Drawdown Limit", key: "drawdownLimitMet" },
                  ].map(({ label, key }) => {
                    const met = (memo.ipsComplianceStatement as Record<string, boolean>)[key];
                    return (
                      <div key={key} style={{
                        background: met ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
                        border: `1px solid ${met ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                        borderRadius: 8, padding: "10px 12px",
                      }}>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: met ? "#4ade80" : "#f87171" }}>
                          {met ? "✓ Met" : "✗ Not Met"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(memo.ipsComplianceStatement as { notes?: string }).notes && (
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                    {(memo.ipsComplianceStatement as { notes: string }).notes}
                  </p>
                )}
              </SectionCard>
            )}

            {/* 9. Recommendation */}
            {memo.recommendation && (
              <SectionCard num="09" title="Recommendation">
                <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", lineHeight: 1.8, fontStyle: "italic" }}>
                  "{typeof memo.recommendation === "string" ? memo.recommendation : JSON.stringify(memo.recommendation)}"
                </p>
              </SectionCard>
            )}
          </>
        )}

        {!memo && (
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "32px",
            textAlign: "center", color: "#64748b",
          }}>
            Board Memo not available for this run.
          </div>
        )}

        {/* Export */}
        {memo && (
          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={exportTxt}
              style={{
                background: "rgba(123,163,212,0.1)",
                border: "1px solid rgba(123,163,212,0.25)",
                borderRadius: 8, padding: "10px 20px",
                color: "#7ba3d4", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⇩ Download Board Memo
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
            Generated by AgenThinkMesh · PortfolioMesh · For informational purposes only
          </p>
          <a href="/portfolio-mesh" style={{ fontSize: 12, color: "#7ba3d4", textDecoration: "none", marginTop: 6, display: "inline-block" }}>
            Run your own portfolio analysis →
          </a>
        </div>
      </div>
    </div>
  );
}
