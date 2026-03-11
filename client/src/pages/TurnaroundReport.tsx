import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionItem {
  rank: number;
  action: string;
  owner: string;
  urgency: "critical" | "high" | "medium";
  impact: "high" | "medium" | "low";
  timeframe: string;
}

interface LeadershipAlert {
  agentId: string;
  agentName: string;
  level: "critical" | "high";
  message: string;
  timestamp: number;
}

interface AgentSection {
  id: string;
  name: string;
  output: Record<string, unknown>;
}

interface TurnaroundReport {
  executiveSummary: string;
  contradictionFlags: string[];
  anomalyAlerts: string[];
  unifiedAssessment: string;
  agents: AgentSection[];
  actionPlan: ActionItem[];
  alertsSummary: LeadershipAlert[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#60A5FA",
};

const URGENCY_BG: Record<string, string> = {
  critical: "#EF444415",
  high: "#F59E0B15",
  medium: "#60A5FA15",
};

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #1E2D47" }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#F0F4FA" }}>{title}</h2>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#0D1829", border: "1px solid #1E2D47", borderRadius: 12, padding: "24px", ...style }}>
      {children}
    </div>
  );
}

// ── Financial Sentinel Section ─────────────────────────────────────────────────

function FinancialSection({ output }: { output: Record<string, unknown> }) {
  const burnRate = output.burnRate as { monthly?: number; currency?: string } | undefined;
  const runway = output.cashRunwayMonths as number | undefined;
  const costCuts = (output.costCutPlan as { lineItem: string; currentCost: string; proposedCut: string; priority: string; implementationWeeks: number }[]) ?? [];
  const risks = (output.keyRisks as string[]) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div style={{ background: "#111E35", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.08em", marginBottom: 8 }}>MONTHLY BURN</div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: "#F59E0B" }}>
            {burnRate?.currency ?? "USD"} {burnRate?.monthly?.toLocaleString() ?? "—"}
          </div>
        </div>
        <div style={{ background: "#111E35", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.08em", marginBottom: 8 }}>CASH RUNWAY</div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: (runway ?? 0) < 3 ? "#EF4444" : (runway ?? 0) < 6 ? "#F59E0B" : "#4ADE80" }}>
            {runway ?? "—"} months
          </div>
        </div>
        <div style={{ background: "#111E35", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.08em", marginBottom: 8 }}>COST-CUT ITEMS</div>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: "#60A5FA" }}>
            {costCuts.length}
          </div>
        </div>
      </div>

      {costCuts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", marginBottom: 10, letterSpacing: "0.06em" }}>COST-CUT PLAN</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {costCuts.slice(0, 6).map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#111E35", borderRadius: 8 }}>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: URGENCY_BG[item.priority] ?? "#1E2D47", color: URGENCY_COLOR[item.priority] ?? "#4A5A72", fontFamily: "monospace", fontWeight: 700 }}>
                  {item.priority?.toUpperCase()}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: "#C8D4E8" }}>{item.lineItem}</span>
                <span style={{ fontSize: 12, color: "#4A5A72", textDecoration: "line-through" }}>{item.currentCost}</span>
                <span style={{ fontSize: 12, color: "#4ADE80" }}>→ {item.proposedCut}</span>
                <span style={{ fontSize: 11, color: "#4A5A72", fontFamily: "monospace" }}>{item.implementationWeeks}w</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {risks.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", marginBottom: 10, letterSpacing: "0.06em" }}>KEY RISKS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {risks.slice(0, 4).map((risk, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#EF444408", border: "1px solid #EF444420", borderRadius: 6, fontSize: 13, color: "#FCA5A5" }}>
                ⚠ {risk}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Customer Pulse Section ────────────────────────────────────────────────────

function CustomerSection({ output }: { output: Record<string, unknown> }) {
  const churnPct = output.churnRiskPercent as number | undefined;
  const atRisk = (output.topAtRiskAccounts as { name: string; revenue: string; churnRisk: string; reason: string }[]) ?? [];
  const recs = (output.recommendations as string[]) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#111E35", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.08em", marginBottom: 8 }}>CHURN RISK</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: (churnPct ?? 0) > 20 ? "#EF4444" : (churnPct ?? 0) > 10 ? "#F59E0B" : "#4ADE80" }}>
            {churnPct ?? 0}%
          </div>
        </div>
        <div style={{ background: "#111E35", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.08em", marginBottom: 8 }}>AT-RISK ACCOUNTS</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: "#F59E0B" }}>
            {atRisk.length}
          </div>
        </div>
      </div>

      {atRisk.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", marginBottom: 10, letterSpacing: "0.06em" }}>PRIORITY CLIENT LIST</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {atRisk.slice(0, 5).map((acct, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#111E35", borderRadius: 8 }}>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: URGENCY_BG[acct.churnRisk] ?? "#1E2D47", color: URGENCY_COLOR[acct.churnRisk] ?? "#4A5A72", fontFamily: "monospace", fontWeight: 700 }}>
                  {acct.churnRisk?.toUpperCase()}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: "#C8D4E8", fontWeight: 600 }}>{acct.name}</span>
                <span style={{ fontSize: 12, color: "#4ADE80" }}>{acct.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", marginBottom: 10, letterSpacing: "0.06em" }}>RECOMMENDATIONS</div>
          {recs.slice(0, 3).map((rec, i) => (
            <div key={i} style={{ padding: "8px 12px", background: "#111E35", borderRadius: 6, fontSize: 13, color: "#C8D4E8", marginBottom: 6 }}>
              → {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action Plan Table ─────────────────────────────────────────────────────────

function ActionPlanTable({ items }: { items: ActionItem[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #1E2D47" }}>
            {["#", "Action", "Owner", "Urgency", "Impact", "Timeframe"].map(h => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #111E35" }}>
              <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 700, color: "#F59E0B", fontSize: 13 }}>{item.rank}</td>
              <td style={{ padding: "12px", color: "#F0F4FA", fontSize: 13, maxWidth: 300 }}>{item.action}</td>
              <td style={{ padding: "12px", color: "#8494AA", fontSize: 12 }}>{item.owner}</td>
              <td style={{ padding: "12px" }}>
                <span style={{ padding: "3px 8px", borderRadius: 4, background: URGENCY_BG[item.urgency] ?? "#1E2D47", color: URGENCY_COLOR[item.urgency] ?? "#4A5A72", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                  {item.urgency?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: "12px" }}>
                <span style={{ padding: "3px 8px", borderRadius: 4, background: item.impact === "high" ? "#4ADE8015" : "#1E2D47", color: item.impact === "high" ? "#4ADE80" : "#4A5A72", fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>
                  {item.impact?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: "12px", color: "#4A5A72", fontSize: 12, fontFamily: "monospace" }}>{item.timeframe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TurnaroundReport() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [, params] = useRoute("/turnaround/report/:id");
  const sessionId = parseInt(params?.id ?? "0", 10);

  const [exportStarted, setExportStarted] = useState(false);
  const [pollingPdf, setPollingPdf] = useState(false);

  const { data, isLoading, error } = trpc.turnaround.getReport.useQuery(
    { sessionId },
    { enabled: !!user && !isNaN(sessionId) && sessionId > 0 }
  );

  const exportPdf = trpc.turnaround.exportPdf.useMutation({
    onSuccess: () => {
      setExportStarted(true);
      setPollingPdf(true);
    },
  });

  const { data: pdfStatus } = trpc.turnaround.getPdfStatus.useQuery(
    { sessionId },
    {
      enabled: pollingPdf,
      refetchInterval: pollingPdf ? 3000 : false,
    }
  );

  useEffect(() => {
    if (pdfStatus?.pdfStatus === "ready" || pdfStatus?.pdfStatus === "error") {
      setPollingPdf(false);
    }
  }, [pdfStatus?.pdfStatus]);

  if (authLoading || isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080F1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "2px solid #1E2D47", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ color: "#4A5A72", fontSize: 13, fontFamily: "monospace" }}>Loading report…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl("/turnaround");
    return null;
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#080F1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: "#EF4444", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Report Unavailable</div>
          <div style={{ color: "#4A5A72", fontSize: 13 }}>{error.message}</div>
          <button onClick={() => navigate("/portfolio")} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 8, background: "#1E2D47", color: "#C8D4E8", border: "none", cursor: "pointer", fontSize: 13 }}>
            ← Back to Portfolio
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const report = data.report as TurnaroundReport;
  const criticalAlerts = (report.alertsSummary ?? []).filter(a => a.level === "critical");
  const highAlerts = (report.alertsSummary ?? []).filter(a => a.level === "high");

  const financialAgent = report.agents?.find(a => a.id === "financial-sentinel");
  const customerAgent = report.agents?.find(a => a.id === "customer-pulse");
  const narrativeAgent = report.agents?.find(a => a.id === "narrative-architect");
  const complianceAgent = report.agents?.find(a => a.id === "compliance-guardian");
  const workflowAgent = report.agents?.find(a => a.id === "workflow-optimizer");

  const pdfReady = pdfStatus?.pdfStatus === "ready";
  const pdfGenerating = pollingPdf && pdfStatus?.pdfStatus === "generating";

  return (
    <div style={{ minHeight: "100vh", background: "#080F1E", color: "#F0F4FA" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Top Nav */}
      <nav style={{ borderBottom: "1px solid #1E2D47", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#080F1E", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate(`/turnaround/command/${sessionId}`)}
            style={{ background: "none", border: "none", color: "#4A5A72", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          >
            ← Command Centre
          </button>
          <div style={{ width: 1, height: 16, background: "#1E2D47" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F0F4FA" }}>
            {data.companyName} · Turnaround Report
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* PDF Export Button */}
          {!exportStarted && !pdfReady && (
            <button
              onClick={() => exportPdf.mutate({ sessionId })}
              disabled={exportPdf.isPending}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "#F59E0B",
                color: "#1A0A00",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: exportPdf.isPending ? 0.7 : 1,
              }}
            >
              📄 Export Report
            </button>
          )}
          {pdfGenerating && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, background: "#1E2D47", fontSize: 12, color: "#8494AA" }}>
              <div style={{ width: 14, height: 14, border: "2px solid #1E2D47", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Generating report…
            </div>
          )}
          {pdfReady && pdfStatus?.pdfUrl && (
            <a
              href={pdfStatus.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "#4ADE80",
                color: "#052E16",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ⬇ Download Report
            </a>
          )}
          <button
            onClick={() => navigate("/portfolio")}
            style={{ padding: "8px 14px", borderRadius: 8, background: "#1E2D47", color: "#C8D4E8", border: "none", cursor: "pointer", fontSize: 12 }}
          >
            Back to Portfolio
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>

        {/* Report Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: "#F59E0B12", border: "1px solid #F59E0B30", fontSize: 10, fontFamily: "monospace", color: "#F59E0B", letterSpacing: "0.1em", marginBottom: 16 }}>
            ⏱ 100-HOUR TURNAROUND · CONFIDENTIAL
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 36, fontWeight: 900, background: "linear-gradient(135deg, #F0F4FA, #FCD34D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {data.companyName}
          </h1>
          <div style={{ fontSize: 14, color: "#8494AA" }}>
            {data.crisisType || "Crisis Response"} · {new Date(data.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
          </div>

          {/* Alert Summary Bar */}
          {(criticalAlerts.length > 0 || highAlerts.length > 0) && (
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              {criticalAlerts.length > 0 && (
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#EF444412", border: "1px solid #EF444430", fontSize: 12, color: "#EF4444", fontFamily: "monospace", fontWeight: 700 }}>
                  ⚠ {criticalAlerts.length} CRITICAL ALERT{criticalAlerts.length > 1 ? "S" : ""}
                </div>
              )}
              {highAlerts.length > 0 && (
                <div style={{ padding: "8px 16px", borderRadius: 8, background: "#F59E0B12", border: "1px solid #F59E0B30", fontSize: 12, color: "#F59E0B", fontFamily: "monospace", fontWeight: 700 }}>
                  ▲ {highAlerts.length} HIGH ALERT{highAlerts.length > 1 ? "S" : ""}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Executive Summary */}
          <Card>
            <SectionHeader title="Executive Summary" icon="📋" />
            <p style={{ margin: 0, fontSize: 15, color: "#C8D4E8", lineHeight: 1.8 }}>{report.executiveSummary}</p>
            {(report.contradictionFlags ?? []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "#EF4444", marginBottom: 8, letterSpacing: "0.06em" }}>CONTRADICTION FLAGS</div>
                {report.contradictionFlags.map((flag, i) => (
                  <div key={i} style={{ padding: "8px 12px", background: "#EF444408", border: "1px solid #EF444420", borderRadius: 6, fontSize: 13, color: "#FCA5A5", marginBottom: 6 }}>
                    ⚠ {flag}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Unified Action Plan */}
          <Card>
            <SectionHeader title="Unified Action Plan — Top 10 Priorities" icon="🎯" />
            {(report.actionPlan ?? []).length > 0 ? (
              <ActionPlanTable items={report.actionPlan} />
            ) : (
              <div style={{ color: "#4A5A72", fontSize: 13 }}>Action plan not available</div>
            )}
          </Card>

          {/* Leadership Alerts */}
          {(report.alertsSummary ?? []).length > 0 && (
            <Card>
              <SectionHeader title="Leadership Alerts" icon="🚨" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {report.alertsSummary.map((alert, i) => (
                  <div key={i} style={{ padding: "12px 16px", borderRadius: 8, background: alert.level === "critical" ? "#EF444408" : "#F59E0B08", border: `1px solid ${alert.level === "critical" ? "#EF444430" : "#F59E0B30"}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: alert.level === "critical" ? "#EF4444" : "#F59E0B", letterSpacing: "0.06em" }}>
                        {alert.level.toUpperCase()} · {alert.agentName}
                      </span>
                      <span style={{ fontSize: 10, color: "#2A3A52", fontFamily: "monospace" }}>
                        {new Date(alert.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#C8D4E8" }}>{alert.message}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Financial Sentinel */}
          {financialAgent && (
            <Card>
              <SectionHeader title="Financial Sentinel — Cash & Burn Analysis" icon="💰" />
              <FinancialSection output={financialAgent.output} />
            </Card>
          )}

          {/* Customer Pulse */}
          {customerAgent && (
            <Card>
              <SectionHeader title="Customer Pulse — Churn Risk & Client Intelligence" icon="📊" />
              <CustomerSection output={customerAgent.output} />
            </Card>
          )}

          {/* Workflow Optimizer */}
          {workflowAgent && (
            <Card>
              <SectionHeader title="Workflow Optimizer — Bottlenecks & Automation" icon="⚙️" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {((workflowAgent.output.bottlenecks as { process: string; timeLostHours: number; severity: string; costImpact: string }[]) ?? []).slice(0, 4).map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "#111E35", borderRadius: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: URGENCY_BG[b.severity] ?? "#1E2D47", color: URGENCY_COLOR[b.severity] ?? "#4A5A72", fontFamily: "monospace", fontWeight: 700 }}>
                      {b.severity?.toUpperCase()}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: "#C8D4E8" }}>{b.process}</span>
                    <span style={{ fontSize: 12, color: "#F59E0B", fontFamily: "monospace" }}>{b.timeLostHours}h lost</span>
                    <span style={{ fontSize: 12, color: "#4A5A72" }}>{b.costImpact}</span>
                  </div>
                ))}
                {((workflowAgent.output.automationProposals as { title: string; estimatedSavings: string; implementationWeeks: number }[]) ?? []).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", marginBottom: 8, letterSpacing: "0.06em" }}>AUTOMATION PROPOSALS</div>
                    {((workflowAgent.output.automationProposals as { title: string; estimatedSavings: string; implementationWeeks: number }[]) ?? []).slice(0, 3).map((p, i) => (
                      <div key={i} style={{ padding: "8px 12px", background: "#111E35", borderRadius: 6, fontSize: 13, color: "#C8D4E8", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                        <span>{p.title}</span>
                        <span style={{ color: "#4ADE80", fontSize: 12 }}>{p.estimatedSavings} · {p.implementationWeeks}w</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Narrative Architect */}
          {narrativeAgent && (
            <Card>
              <SectionHeader title="Narrative Architect — Crisis Communications" icon="✍️" />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {!!narrativeAgent.output.allStaffMemo && (
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", marginBottom: 8, letterSpacing: "0.06em" }}>ALL-STAFF MEMO</div>
                    <div style={{ background: "#111E35", borderRadius: 8, padding: "16px", fontSize: 13, color: "#C8D4E8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {String(narrativeAgent.output.allStaffMemo)}
                    </div>
                  </div>
                )}
                {!!narrativeAgent.output.investorLetter && (
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", marginBottom: 8, letterSpacing: "0.06em" }}>INVESTOR LETTER</div>
                    <div style={{ background: "#111E35", borderRadius: 8, padding: "16px", fontSize: 13, color: "#C8D4E8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {String(narrativeAgent.output.investorLetter)}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Compliance Guardian */}
          {complianceAgent && (
            <Card>
              <SectionHeader title="Compliance Guardian — Risk & Regulatory" icon="🛡️" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {((complianceAgent.output.riskFlagRegister as { flag: string; severity: string; regulation: string; daysToResolve: number }[]) ?? []).slice(0, 5).map((flag, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px", background: "#111E35", borderRadius: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: URGENCY_BG[flag.severity] ?? "#1E2D47", color: URGENCY_COLOR[flag.severity] ?? "#4A5A72", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {flag.severity?.toUpperCase()}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#C8D4E8" }}>{flag.flag}</div>
                      <div style={{ fontSize: 11, color: "#4A5A72", marginTop: 2 }}>{flag.regulation} · {flag.daysToResolve}d to resolve</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Unified Assessment */}
          {report.unifiedAssessment && (
            <Card>
              <SectionHeader title="Resilience Logger — Unified Assessment" icon="🧠" />
              <p style={{ margin: 0, fontSize: 14, color: "#C8D4E8", lineHeight: 1.8 }}>{report.unifiedAssessment}</p>
            </Card>
          )}

          {/* Footer */}
          <div style={{ padding: "20px 0", borderTop: "1px solid #1E2D47", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#2A3A52" }}>
            <span>AgenThink · 100-Hour Turnaround · Confidential</span>
            <span>{new Date(data.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
