import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import Logo from "@/components/Logo";
import { toast } from "sonner";

const NAVY_950 = "#080F1E";
const NAVY_900 = "#0C1628";
const NAVY_800 = "#111E35";
const NAVY_700 = "#162440";
const STEEL = "#1E2D47";
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const SILVER_50 = "#F0F4FA";
const SILVER_100 = "#E0E8F4";
const SILVER_200 = "#C8D4E8";
const SILVER_400 = "#8494AA";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const ALIGNMENT_COLORS: Record<string, string> = {
  "Aligned": "#4ADE80",
  "Partial Deviation": GOLD,
  "Significant Deviation": "#EF4444",
};

const RISK_COLORS: Record<string, string> = {
  "Low": "#4ADE80",
  "Medium": GOLD,
  "High": "#EF4444",
};

const NARRATIVE_COLORS: Record<string, string> = {
  "Consistent": "#4ADE80",
  "Partially Consistent": GOLD,
  "Inconsistent": "#EF4444",
};

function Badge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const color = colorMap[label] ?? SILVER_400;
  return (
    <span style={{
      padding: "4px 12px", borderRadius: 20,
      fontSize: 12, fontFamily: MONO, fontWeight: 700,
      color, background: `${color}18`, border: `1px solid ${color}40`,
      letterSpacing: "0.04em",
    }}>{label}</span>
  );
}

function Section({ title, accent = GOLD, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: 16,
        paddingBottom: 10,
        borderBottom: `1px solid ${STEEL}`,
      }}>
        <div style={{ width: 3, height: 18, background: accent, borderRadius: 2, flexShrink: 0 }} />
        <h2 style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: SILVER_200, letterSpacing: "0.08em", margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

export default function PortfolioReport() {
  const params = useParams<{ id: string }>();
  const reviewId = parseInt(params.id ?? "0", 10);

  const { data: review, isLoading } = trpc.portfolio.get.useQuery(
    { id: reviewId },
    { enabled: !!reviewId }
  );

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_950, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${STEEL}`, borderTopColor: GOLD, animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 12, color: SILVER_400, fontFamily: MONO }}>Loading report…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!review || review.status !== "complete") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_950, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <div style={{ textAlign: "center", color: SILVER_400 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div>Report not available.</div>
          <a href="/portfolio" style={{ color: GOLD, fontSize: 13, marginTop: 12, display: "block" }}>← Back to Portfolio Intelligence</a>
        </div>
      </div>
    );
  }

  const report = (() => {
    try { return JSON.parse(review.reportJson ?? "{}"); } catch { return {}; }
  })();

  const docs: { fileName: string }[] = (() => {
    try { return JSON.parse(review.documents ?? "[]"); } catch { return []; }
  })();

  const handleDownload = () => {
    // Build a simple text report for download
    const lines = [
      "AGENTHINK PORTFOLIO INTELLIGENCE",
      "PORTFOLIO REVIEW REPORT",
      "═══════════════════════════════════════",
      "",
      `Fund Name: ${review.fundName ?? "Not specified"}`,
      `Manager: ${review.manager ?? "Not specified"}`,
      `Review Period: ${review.reviewPeriod ?? "Not specified"}`,
      `Generated: ${new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
      "",
      "═══════════════════════════════════════",
      "EXECUTIVE SUMMARY",
      "═══════════════════════════════════════",
      report.executiveSummary ?? "",
      "",
      "═══════════════════════════════════════",
      "MANDATE ALIGNMENT",
      "═══════════════════════════════════════",
      `Verdict: ${report.mandateAlignment ?? ""}`,
      "",
      report.mandateSummary ?? "",
      "",
      ...(Array.isArray(report.mandateDeviations) && report.mandateDeviations.length > 0
        ? ["Deviations Identified:", ...report.mandateDeviations.map((d: string) => `  • ${d}`), ""]
        : []),
      "═══════════════════════════════════════",
      "RISK ASSESSMENT",
      "═══════════════════════════════════════",
      `Overall Risk Rating: ${report.overallRiskRating ?? ""}`,
      "",
      report.riskSummary ?? "",
      "",
      ...(Array.isArray(report.riskSignals) && report.riskSignals.length > 0
        ? ["Risk Signals:", ...report.riskSignals.map((r: string) => `  • ${r}`), ""]
        : []),
      "═══════════════════════════════════════",
      "MANAGER NARRATIVE ASSESSMENT",
      "═══════════════════════════════════════",
      `Narrative Consistency: ${report.narrativeConsistency ?? ""}`,
      `Confidence Score: ${report.confidenceScore ?? 0}/100`,
      "",
      report.narrativeAssessment ?? "",
      "",
      ...(Array.isArray(report.keyQuestions) && report.keyQuestions.length > 0
        ? ["Key Questions for Manager:", ...report.keyQuestions.map((q: string) => `  • ${q}`), ""]
        : []),
      "═══════════════════════════════════════",
      "SECTOR ALLOCATION",
      "═══════════════════════════════════════",
      `Concentration Risk: ${report.concentrationRisk ?? ""}`,
      `Diversification Score: ${report.diversificationScore ?? 0}/100`,
      "",
      ...(Array.isArray(report.topSectors) && report.topSectors.length > 0
        ? ["Top Sectors:", ...report.topSectors.map((s: { sector?: string; allocation?: string; commentary?: string }) => `  ${s.sector ?? ""} (${s.allocation ?? ""}) — ${s.commentary ?? ""}`), ""]
        : []),
      "═══════════════════════════════════════",
      "Prepared by AgenThink Portfolio Intelligence",
      "This report is generated by AI analysis and should be reviewed by qualified investment professionals.",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Portfolio-Review-${review.fundName ?? "Report"}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_50 }}>
      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 40px",
        borderBottom: `1px solid ${STEEL}`,
        background: `${NAVY_900}F8`,
        backdropFilter: "blur(16px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/portfolio" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            ← Portfolio Intelligence
          </a>
          <a href="/vault" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            Vault
          </a>
          <button
            onClick={handleDownload}
            style={{
              padding: "8px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
              border: "none", color: NAVY_950,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: MONO, letterSpacing: "0.04em",
            }}
          >
            ↓ Download Report
          </button>
        </div>
      </nav>

      {/* Report */}
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 40px 80px", boxSizing: "border-box" }}>
        {/* Cover block */}
        <div style={{
          background: NAVY_800,
          border: `1px solid ${STEEL}`,
          borderRadius: 16,
          padding: "32px 36px",
          marginBottom: 32,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT}, transparent)` }} />
          <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD, letterSpacing: "0.1em", marginBottom: 14 }}>
            AGENTHINK PORTFOLIO INTELLIGENCE · REVIEW REPORT
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(22px, 3.5vw, 34px)", fontWeight: 900, color: SILVER_50, marginBottom: 6, lineHeight: 1.2 }}>
            {review.fundName ?? "Portfolio Review"}
          </h1>
          {review.manager && (
            <div style={{ fontSize: 14, color: SILVER_400, marginBottom: 14 }}>{review.manager}</div>
          )}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {review.reviewPeriod && (
              <div style={{ fontSize: 12, color: SILVER_600, fontFamily: MONO }}>
                Period: <span style={{ color: SILVER_200 }}>{review.reviewPeriod}</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: SILVER_600, fontFamily: MONO }}>
              Generated: <span style={{ color: SILVER_200 }}>{new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div style={{ fontSize: 12, color: SILVER_600, fontFamily: MONO }}>
              Documents: <span style={{ color: SILVER_200 }}>{docs.length}</span>
            </div>
          </div>
        </div>

        {/* Key verdicts row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Mandate Alignment", value: report.mandateAlignment ?? "—", colorMap: ALIGNMENT_COLORS },
            { label: "Overall Risk", value: report.overallRiskRating ?? "—", colorMap: RISK_COLORS },
            { label: "Narrative Consistency", value: report.narrativeConsistency ?? "—", colorMap: NARRATIVE_COLORS },
          ].map(item => (
            <div key={item.label} style={{
              background: NAVY_800,
              border: `1px solid ${STEEL}`,
              borderRadius: 12,
              padding: "18px 20px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.06em", marginBottom: 10 }}>
                {item.label.toUpperCase()}
              </div>
              <Badge label={item.value} colorMap={item.colorMap} />
            </div>
          ))}
        </div>

        {/* Executive Summary */}
        <Section title="EXECUTIVE SUMMARY">
          <p style={{ fontSize: 14, color: SILVER_200, lineHeight: 1.75 }}>
            {report.executiveSummary ?? "No summary available."}
          </p>
        </Section>

        {/* Mandate Alignment */}
        <Section title="MANDATE ALIGNMENT ASSESSMENT" accent="#7BA3D4">
          <div style={{ marginBottom: 14 }}>
            <Badge label={report.mandateAlignment ?? "—"} colorMap={ALIGNMENT_COLORS} />
          </div>
          <p style={{ fontSize: 14, color: SILVER_200, lineHeight: 1.75, marginBottom: 16 }}>
            {report.mandateSummary ?? ""}
          </p>
          {Array.isArray(report.mandateDeviations) && report.mandateDeviations.length > 0 && (
            <div style={{ background: NAVY_700, border: `1px solid ${STEEL}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, letterSpacing: "0.06em", marginBottom: 12 }}>DEVIATIONS IDENTIFIED</div>
              {report.mandateDeviations.map((d: string, i: number) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: GOLD, flexShrink: 0, marginTop: 1 }}>▸</span>
                  <span style={{ fontSize: 13, color: SILVER_200, lineHeight: 1.6 }}>{d}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Risk Assessment */}
        <Section title="RISK ASSESSMENT" accent="#EF4444">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Badge label={report.overallRiskRating ?? "—"} colorMap={RISK_COLORS} />
            {typeof report.diversificationScore === "number" && (
              <span style={{ fontSize: 12, color: SILVER_400, fontFamily: MONO }}>
                Diversification: <span style={{ color: SILVER_200 }}>{report.diversificationScore}/100</span>
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: SILVER_200, lineHeight: 1.75, marginBottom: 16 }}>
            {report.riskSummary ?? ""}
          </p>
          {Array.isArray(report.riskSignals) && report.riskSignals.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {report.riskSignals.map((signal: string, i: number) => (
                <div key={i} style={{
                  padding: "10px 14px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  fontSize: 13, color: SILVER_200, lineHeight: 1.5,
                }}>
                  ⚠ {signal}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Sector Allocation */}
        {Array.isArray(report.topSectors) && report.topSectors.length > 0 && (
          <Section title="SECTOR ALLOCATION" accent="#A78BFA">
            {report.concentrationRisk && (
              <p style={{ fontSize: 13, color: SILVER_400, marginBottom: 16, fontFamily: MONO }}>
                Concentration Risk: <span style={{ color: SILVER_200 }}>{report.concentrationRisk}</span>
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {report.topSectors.map((s: { sector?: string; allocation?: string; commentary?: string }, i: number) => (
                <div key={i} style={{
                  background: NAVY_800,
                  border: `1px solid ${STEEL}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  display: "flex", gap: 16, alignItems: "flex-start",
                }}>
                  <div style={{ minWidth: 100 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: SILVER_50 }}>{s.sector ?? "—"}</div>
                    {s.allocation && <div style={{ fontSize: 11, color: GOLD, fontFamily: MONO, marginTop: 2 }}>{s.allocation}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: SILVER_400, lineHeight: 1.6, flex: 1 }}>{s.commentary ?? ""}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Manager Narrative */}
        <Section title="MANAGER NARRATIVE ASSESSMENT" accent={GOLD}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Badge label={report.narrativeConsistency ?? "—"} colorMap={NARRATIVE_COLORS} />
            {typeof report.confidenceScore === "number" && (
              <span style={{ fontSize: 12, color: SILVER_400, fontFamily: MONO }}>
                Confidence: <span style={{ color: SILVER_200 }}>{report.confidenceScore}/100</span>
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: SILVER_200, lineHeight: 1.75, marginBottom: 16 }}>
            {report.narrativeAssessment ?? ""}
          </p>
          {Array.isArray(report.keyQuestions) && report.keyQuestions.length > 0 && (
            <div style={{ background: NAVY_700, border: `1px solid ${STEEL}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, letterSpacing: "0.06em", marginBottom: 12 }}>KEY QUESTIONS FOR MANAGER</div>
              {report.keyQuestions.map((q: string, i: number) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: GOLD, flexShrink: 0, fontFamily: MONO, fontSize: 11, marginTop: 2 }}>{i + 1}.</span>
                  <span style={{ fontSize: 13, color: SILVER_200, lineHeight: 1.6 }}>{q}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Footer disclaimer */}
        <div style={{
          marginTop: 40,
          padding: "16px 20px",
          background: NAVY_800,
          border: `1px solid ${STEEL}`,
          borderRadius: 10,
          fontSize: 11,
          color: SILVER_600,
          lineHeight: 1.65,
          fontFamily: MONO,
        }}>
          This report is generated by AgenThink Portfolio Intelligence using AI analysis of the provided documents. It is intended to assist investment professionals and does not constitute investment advice. All findings should be reviewed by qualified investment professionals before use in investment decisions.
        </div>
      </main>
    </div>
  );
}
